"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { generateDrafts, type DraftSourceInput } from "@/lib/ai";
import { requireAdmin } from "@/lib/auth";
import { getOpenAIEnv } from "@/lib/env";
import { errorMessage, messageUrl } from "@/lib/errors";
import { compareAgainstSources } from "@/lib/similarity";

const draftIdSchema = z.string().uuid();
const statusSchema = z.enum(["pending", "approved", "rejected", "saved"]);
const PROMPT_VERSION = "phase1-v1";

async function getDraftSources(
  draftId: string,
  userId: string,
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
) {
  const { data: links, error: linksError } = await supabase
    .from("draft_sources")
    .select("source_post_id")
    .eq("user_id", userId)
    .eq("draft_id", draftId);
  if (linksError) throw linksError;
  const sourceIds = (links ?? []).map((link) => link.source_post_id);
  if (sourceIds.length === 0) throw new Error("This draft has no linked sources.");

  const { data: posts, error: postsError } = await supabase
    .from("source_posts")
    .select("id, text_content, author_username, published_at")
    .eq("user_id", userId)
    .in("id", sourceIds);
  if (postsError) throw postsError;
  if (!posts || posts.length === 0) throw new Error("Linked source posts were not found.");

  const { data: analyses, error: analysesError } = await supabase
    .from("post_analyses")
    .select(
      "source_post_id, topic, hook_type, format, emotional_trigger, response_reason, structural_pattern, created_at",
    )
    .eq("user_id", userId)
    .in("source_post_id", sourceIds)
    .order("created_at", { ascending: false });
  if (analysesError) throw analysesError;

  const latest = new Map<string, NonNullable<typeof analyses>[number]>();
  for (const analysis of analyses ?? []) {
    if (!latest.has(analysis.source_post_id)) latest.set(analysis.source_post_id, analysis);
  }

  return posts.map((post): DraftSourceInput => {
    const analysis = latest.get(post.id);
    return {
      id: post.id,
      text: post.text_content,
      author: post.author_username,
      publishedAt: post.published_at,
      analysis: analysis
        ? {
            topic: analysis.topic,
            hook_type: analysis.hook_type,
            format: analysis.format,
            emotional_trigger: analysis.emotional_trigger,
            response_reason: analysis.response_reason,
            structural_pattern: analysis.structural_pattern,
          }
        : null,
    };
  });
}

export async function updateDraftStatusAction(formData: FormData) {
  let destination: string;
  try {
    const draftId = draftIdSchema.parse(formData.get("draftId"));
    const status = statusSchema.parse(formData.get("status"));
    const { user, supabase } = await requireAdmin();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("drafts")
      .update({
        status,
        approved_at: status === "approved" ? now : null,
        rejected_at: status === "rejected" ? now : null,
      })
      .eq("id", draftId)
      .eq("user_id", user.id);
    if (error) throw error;

    await supabase.from("audit_events").insert({
      user_id: user.id,
      event_type: `draft_${status}`,
      entity_type: "draft",
      entity_id: draftId,
      metadata: { publishing_attempted: false },
    });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/drafts");
    destination = messageUrl(
      "/dashboard/drafts",
      "success",
      status === "approved"
        ? "Draft approved internally. Nothing was published."
        : `Draft marked ${status}.`,
    );
  } catch (error) {
    destination = messageUrl("/dashboard/drafts", "error", errorMessage(error));
  }
  redirect(destination);
}

export async function editDraftAction(formData: FormData) {
  let destination: string;
  try {
    const draftId = draftIdSchema.parse(formData.get("draftId"));
    const body = z.string().trim().min(1).max(1000).parse(formData.get("body"));
    const { user, supabase } = await requireAdmin();
    const sources = await getDraftSources(draftId, user.id, supabase);
    const env = getOpenAIEnv();
    const similarity = compareAgainstSources(
      body,
      sources.map((source) => source.text),
    );
    if (similarity.maxScore >= env.DRAFT_SIMILARITY_THRESHOLD) {
      throw new Error(
        `Edit blocked: similarity ${Math.round(similarity.maxScore * 100)}% exceeds the ${Math.round(env.DRAFT_SIMILARITY_THRESHOLD * 100)}% limit.`,
      );
    }

    const { error } = await supabase
      .from("drafts")
      .update({ body, max_similarity: similarity.maxScore, status: "pending" })
      .eq("id", draftId)
      .eq("user_id", user.id);
    if (error) throw error;
    await supabase.from("audit_events").insert({
      user_id: user.id,
      event_type: "draft_edited",
      entity_type: "draft",
      entity_id: draftId,
      metadata: { max_similarity: similarity.maxScore },
    });
    revalidatePath("/dashboard/drafts");
    destination = messageUrl("/dashboard/drafts", "success", "Draft updated.");
  } catch (error) {
    destination = messageUrl("/dashboard/drafts", "error", errorMessage(error));
  }
  redirect(destination);
}

export async function regenerateDraftAction(formData: FormData) {
  let destination: string;
  try {
    const draftId = draftIdSchema.parse(formData.get("draftId"));
    const feedback = z.string().trim().max(500).optional().parse(
      formData.get("feedback") || undefined,
    );
    const { user, supabase } = await requireAdmin();
    const sources = await getDraftSources(draftId, user.id, supabase);
    const generated = await generateDrafts(sources, 1, feedback);
    const candidate = generated[0];
    if (!candidate) throw new Error("OpenAI did not return a replacement draft.");

    const env = getOpenAIEnv();
    const similarity = compareAgainstSources(
      candidate.body,
      sources.map((source) => source.text),
    );
    if (similarity.maxScore >= env.DRAFT_SIMILARITY_THRESHOLD) {
      throw new Error("The replacement was too similar to a source. Regenerate again.");
    }

    const { data: replacement, error: replacementError } = await supabase
      .from("drafts")
      .insert({
        user_id: user.id,
        body: candidate.body,
        status: "pending",
        rationale: candidate.rationale,
        pattern_summary: candidate.pattern_summary,
        max_similarity: similarity.maxScore,
        similarity_threshold: env.DRAFT_SIMILARITY_THRESHOLD,
        model: env.OPENAI_MODEL,
        prompt_version: PROMPT_VERSION,
        generation_metadata: { regenerated_from: draftId, feedback: feedback ?? null },
      })
      .select("id")
      .single();
    if (replacementError || !replacement) {
      throw replacementError ?? new Error("Could not save replacement draft.");
    }

    const { error: linksError } = await supabase.from("draft_sources").insert(
      sources.map((source, index) => ({
        user_id: user.id,
        draft_id: replacement.id,
        source_post_id: source.id,
        similarity_score: similarity.comparisons[index]?.score ?? 0,
      })),
    );
    if (linksError) throw linksError;

    const { error: oldDraftError } = await supabase
      .from("drafts")
      .update({ status: "rejected", rejected_at: new Date().toISOString() })
      .eq("id", draftId)
      .eq("user_id", user.id);
    if (oldDraftError) throw oldDraftError;

    await supabase.from("audit_events").insert([
      {
        user_id: user.id,
        event_type: "draft_regenerated",
        entity_type: "draft",
        entity_id: replacement.id,
        metadata: { replaced_draft_id: draftId },
      },
      {
        user_id: user.id,
        event_type: "draft_rejected",
        entity_type: "draft",
        entity_id: draftId,
        metadata: { reason: "regenerated" },
      },
    ]);

    revalidatePath("/dashboard/drafts");
    destination = messageUrl(
      "/dashboard/drafts",
      "success",
      "Replacement draft generated; the previous version was rejected.",
    );
  } catch (error) {
    destination = messageUrl("/dashboard/drafts", "error", errorMessage(error));
  }
  redirect(destination);
}
