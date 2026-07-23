"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  analyzePosts,
  generateDrafts,
  type DraftSourceInput,
} from "@/lib/ai";
import { requireAdmin } from "@/lib/auth";
import { getOpenAIEnv } from "@/lib/env";
import { errorMessage, messageUrl } from "@/lib/errors";
import { compareAgainstSources } from "@/lib/similarity";

const selectionSchema = z.array(z.string().uuid()).min(1).max(8);
const PROMPT_VERSION = "phase1-v1";

function getSelection(formData: FormData) {
  return selectionSchema.parse(formData.getAll("sourceIds"));
}

export async function analyzeSelectedAction(formData: FormData) {
  let destination: string;
  try {
    const selectedIds = getSelection(formData);
    const { user, supabase } = await requireAdmin();
    const { data: posts, error } = await supabase
      .from("source_posts")
      .select("id, text_content, author_username, published_at")
      .eq("user_id", user.id)
      .in("id", selectedIds);
    if (error) throw error;
    if (!posts || posts.length === 0) throw new Error("No source posts were selected.");

    const analyses = await analyzePosts(
      posts.map((post) => ({
        id: post.id,
        text: post.text_content,
        author: post.author_username,
        publishedAt: post.published_at,
      })),
    );
    const validIds = new Set(posts.map((post) => post.id));
    const rows = analyses
      .filter((analysis) => validIds.has(analysis.source_post_id))
      .map((analysis) => ({
        user_id: user.id,
        source_post_id: analysis.source_post_id,
        topic: analysis.topic,
        hook_type: analysis.hook_type,
        format: analysis.format,
        emotional_trigger: analysis.emotional_trigger,
        response_reason: analysis.response_reason,
        structural_pattern: analysis.structural_pattern,
        confidence: analysis.confidence,
        model: getOpenAIEnv().OPENAI_MODEL,
        prompt_version: PROMPT_VERSION,
      }));
    if (rows.length === 0) {
      throw new Error("The analysis response did not match any selected sources.");
    }

    const { error: insertError } = await supabase.from("post_analyses").insert(rows);
    if (insertError) throw insertError;
    await supabase.from("audit_events").insert(
      rows.map((row) => ({
        user_id: user.id,
        event_type: "source_analyzed",
        entity_type: "source_post",
        entity_id: row.source_post_id,
        metadata: { model: row.model, prompt_version: PROMPT_VERSION },
      })),
    );

    revalidatePath("/dashboard/library");
    destination = messageUrl(
      "/dashboard/library",
      "success",
      `Analyzed ${rows.length} post${rows.length === 1 ? "" : "s"}.`,
    );
  } catch (error) {
    destination = messageUrl("/dashboard/library", "error", errorMessage(error));
  }
  redirect(destination);
}

export async function generateDraftsAction(formData: FormData) {
  let destination: string;
  try {
    const selectedIds = getSelection(formData);
    const { user, supabase } = await requireAdmin();
    const { data: posts, error: postsError } = await supabase
      .from("source_posts")
      .select("id, text_content, author_username, published_at")
      .eq("user_id", user.id)
      .in("id", selectedIds);
    if (postsError) throw postsError;
    if (!posts || posts.length === 0) throw new Error("No source posts were selected.");

    const { data: analyses, error: analysesError } = await supabase
      .from("post_analyses")
      .select(
        "source_post_id, topic, hook_type, format, emotional_trigger, response_reason, structural_pattern, created_at",
      )
      .eq("user_id", user.id)
      .in("source_post_id", posts.map((post) => post.id))
      .order("created_at", { ascending: false });
    if (analysesError) throw analysesError;

    const latestAnalysis = new Map<string, NonNullable<typeof analyses>[number]>();
    for (const analysis of analyses ?? []) {
      if (!latestAnalysis.has(analysis.source_post_id)) {
        latestAnalysis.set(analysis.source_post_id, analysis);
      }
    }

    const sources: DraftSourceInput[] = posts.map((post) => {
      const analysis = latestAnalysis.get(post.id);
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

    const generated = await generateDrafts(sources, 3);
    const env = getOpenAIEnv();
    let savedCount = 0;
    for (const draft of generated) {
      const similarity = compareAgainstSources(
        draft.body,
        sources.map((source) => source.text),
      );
      if (similarity.maxScore >= env.DRAFT_SIMILARITY_THRESHOLD) continue;

      const { data: savedDraft, error: draftError } = await supabase
        .from("drafts")
        .insert({
          user_id: user.id,
          body: draft.body,
          status: "pending",
          rationale: draft.rationale,
          pattern_summary: draft.pattern_summary,
          max_similarity: similarity.maxScore,
          similarity_threshold: env.DRAFT_SIMILARITY_THRESHOLD,
          model: env.OPENAI_MODEL,
          prompt_version: PROMPT_VERSION,
          generation_metadata: { source_count: sources.length },
        })
        .select("id")
        .single();
      if (draftError || !savedDraft) {
        throw draftError ?? new Error("Could not save a generated draft.");
      }

      const { error: sourcesError } = await supabase.from("draft_sources").insert(
        sources.map((source, index) => ({
          user_id: user.id,
          draft_id: savedDraft.id,
          source_post_id: source.id,
          similarity_score: similarity.comparisons[index]?.score ?? 0,
        })),
      );
      if (sourcesError) throw sourcesError;

      await supabase.from("audit_events").insert({
        user_id: user.id,
        event_type: "draft_generated",
        entity_type: "draft",
        entity_id: savedDraft.id,
        metadata: {
          source_ids: sources.map((source) => source.id),
          max_similarity: similarity.maxScore,
          model: env.OPENAI_MODEL,
        },
      });
      savedCount += 1;
    }

    if (savedCount === 0) {
      throw new Error(
        "Every generated draft exceeded the similarity threshold. Try different sources.",
      );
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/drafts");
    destination = messageUrl(
      "/dashboard/drafts",
      "success",
      `Generated ${savedCount} original draft${savedCount === 1 ? "" : "s"}.`,
    );
  } catch (error) {
    destination = messageUrl("/dashboard/library", "error", errorMessage(error));
  }
  redirect(destination);
}
