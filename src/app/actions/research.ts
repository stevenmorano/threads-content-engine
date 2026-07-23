"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { decryptSecret } from "@/lib/crypto";
import { errorMessage, messageUrl } from "@/lib/errors";
import { rankPost, SCORING_VERSION } from "@/lib/ranking";
import { searchThreads } from "@/lib/threads/client";
import type { ThreadsPost } from "@/lib/threads/types";

const topicSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).optional(),
});

const keywordSchema = z.object({
  term: z.string().trim().min(1).max(100),
  kind: z.enum(["search", "exclude"]),
  topicId: z.string().uuid().optional(),
});

const toggleSchema = z.object({
  id: z.string().uuid(),
  isActive: z.enum(["true", "false"]),
});

const searchSchema = z.object({
  keywordId: z.string().uuid(),
  searchType: z.enum(["TOP", "RECENT"]),
});

function ownerId(post: ThreadsPost) {
  if (typeof post.owner === "string") return post.owner;
  return post.owner?.id ?? null;
}

export async function createTopicAction(formData: FormData) {
  let destination: string;
  try {
    const input = topicSchema.parse({
      name: formData.get("name"),
      description: formData.get("description") || undefined,
    });
    const { user, supabase } = await requireAdmin();
    const { error } = await supabase.from("topics").insert({
      user_id: user.id,
      name: input.name,
      description: input.description ?? null,
    });
    if (error) throw error;
    revalidatePath("/dashboard/research");
    destination = messageUrl("/dashboard/research", "success", "Topic added.");
  } catch (error) {
    destination = messageUrl("/dashboard/research", "error", errorMessage(error));
  }
  redirect(destination);
}

export async function createKeywordAction(formData: FormData) {
  let destination: string;
  try {
    const rawTopicId = formData.get("topicId");
    const input = keywordSchema.parse({
      term: formData.get("term"),
      kind: formData.get("kind"),
      topicId: rawTopicId ? rawTopicId : undefined,
    });
    const { user, supabase } = await requireAdmin();
    const { error } = await supabase.from("research_keywords").insert({
      user_id: user.id,
      term: input.term,
      kind: input.kind,
      topic_id: input.topicId ?? null,
    });
    if (error) throw error;
    revalidatePath("/dashboard/research");
    destination = messageUrl(
      "/dashboard/research",
      "success",
      input.kind === "search" ? "Search keyword added." : "Exclusion added.",
    );
  } catch (error) {
    destination = messageUrl("/dashboard/research", "error", errorMessage(error));
  }
  redirect(destination);
}

export async function toggleKeywordAction(formData: FormData) {
  let destination: string;
  try {
    const input = toggleSchema.parse({
      id: formData.get("id"),
      isActive: formData.get("isActive"),
    });
    const { user, supabase } = await requireAdmin();
    const { error } = await supabase
      .from("research_keywords")
      .update({ is_active: input.isActive === "true" })
      .eq("id", input.id)
      .eq("user_id", user.id);
    if (error) throw error;
    revalidatePath("/dashboard/research");
    destination = messageUrl("/dashboard/research", "success", "Keyword updated.");
  } catch (error) {
    destination = messageUrl("/dashboard/research", "error", errorMessage(error));
  }
  redirect(destination);
}

export async function manualSearchAction(formData: FormData) {
  let destination: string;
  let runId: string | null = null;
  const { user, supabase } = await requireAdmin();

  try {
    const input = searchSchema.parse({
      keywordId: formData.get("keywordId"),
      searchType: formData.get("searchType"),
    });

    const { data: keyword, error: keywordError } = await supabase
      .from("research_keywords")
      .select("id, term")
      .eq("id", input.keywordId)
      .eq("user_id", user.id)
      .eq("kind", "search")
      .eq("is_active", true)
      .single();
    if (keywordError || !keyword) throw keywordError ?? new Error("Keyword not found.");

    const { data: connection, error: connectionError } = await supabase
      .from("threads_connections")
      .select("access_token_ciphertext, status")
      .eq("user_id", user.id)
      .eq("status", "connected")
      .single();
    if (connectionError || !connection) {
      throw new Error("Connect your Threads account before searching.");
    }

    const { data: run, error: runError } = await supabase
      .from("search_runs")
      .insert({
        user_id: user.id,
        keyword_id: keyword.id,
        query: keyword.term,
        search_type: input.searchType,
        trigger_type: "manual",
        status: "running",
      })
      .select("id")
      .single();
    if (runError || !run) throw runError ?? new Error("Could not start search.");
    runId = run.id;

    const token = decryptSecret(connection.access_token_ciphertext);
    const response = await searchThreads(token, keyword.term, input.searchType);

    const { data: exclusions, error: exclusionsError } = await supabase
      .from("research_keywords")
      .select("term")
      .eq("user_id", user.id)
      .eq("kind", "exclude")
      .eq("is_active", true);
    if (exclusionsError) throw exclusionsError;

    const excludedTerms = (exclusions ?? []).map((item) => item.term.toLowerCase());
    const included = response.data.filter((post) => {
      const text = (post.text ?? "").toLowerCase();
      return !excludedTerms.some((term) => text.includes(term));
    });
    const excludedCount = response.data.length - included.length;

    if (included.length > 0) {
      const postRows = included.map((post) => ({
        user_id: user.id,
        threads_post_id: post.id,
        author_threads_id: ownerId(post),
        author_username: post.username ?? null,
        text_content: post.text ?? "",
        permalink: post.permalink ?? null,
        media_product_type: post.media_product_type ?? null,
        media_type: post.media_type ?? null,
        shortcode: post.shortcode ?? null,
        is_quote_post: post.is_quote_post ?? null,
        has_replies: post.has_replies ?? null,
        published_at: post.timestamp ?? null,
        raw_payload: post,
        last_seen_at: new Date().toISOString(),
      }));

      const { data: storedPosts, error: postsError } = await supabase
        .from("source_posts")
        .upsert(postRows, { onConflict: "user_id,threads_post_id" })
        .select("id, threads_post_id");
      if (postsError || !storedPosts) {
        throw postsError ?? new Error("Could not save discovered posts.");
      }

      const sourceIds = new Map(
        storedPosts.map((post) => [post.threads_post_id, post.id]),
      );
      const runPostRows = included.flatMap((post, apiPosition) => {
        const sourcePostId = sourceIds.get(post.id);
        if (!sourcePostId) return [];
        const rank = rankPost({
          text: post.text ?? "",
          query: keyword.term,
          publishedAt: post.timestamp ?? null,
          apiPosition,
          resultCount: included.length,
        });
        return [{
          user_id: user.id,
          search_run_id: run.id,
          source_post_id: sourcePostId,
          api_position: apiPosition,
          matched_terms: [keyword.term],
          relevance_score: rank.relevance,
          recency_score: rank.recency,
          api_order_score: rank.apiOrder,
          engagement_score: rank.engagement,
          reply_like_score: rank.replyLike,
          total_score: rank.total,
          available_signals: rank.availableSignals,
          scoring_version: SCORING_VERSION,
        }];
      });

      const { error: runPostsError } = await supabase
        .from("search_run_posts")
        .upsert(runPostRows, { onConflict: "search_run_id,source_post_id" });
      if (runPostsError) throw runPostsError;
    }

    const { error: completeError } = await supabase
      .from("search_runs")
      .update({
        status: "completed",
        result_count: included.length,
        excluded_count: excludedCount,
        completed_at: new Date().toISOString(),
      })
      .eq("id", run.id)
      .eq("user_id", user.id);
    if (completeError) throw completeError;

    await supabase.from("audit_events").insert({
      user_id: user.id,
      event_type: "threads_search_completed",
      entity_type: "search_run",
      entity_id: run.id,
      metadata: {
        query: keyword.term,
        search_type: input.searchType,
        result_count: included.length,
        excluded_count: excludedCount,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/research");
    revalidatePath("/dashboard/library");
    destination = messageUrl(
      "/dashboard/research",
      "success",
      `Saved ${included.length} post${included.length === 1 ? "" : "s"}.`,
    );
  } catch (error) {
    if (runId) {
      await supabase
        .from("search_runs")
        .update({
          status: "failed",
          error_message: errorMessage(error),
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId)
        .eq("user_id", user.id);
    }
    destination = messageUrl("/dashboard/research", "error", errorMessage(error));
  }

  redirect(destination);
}
