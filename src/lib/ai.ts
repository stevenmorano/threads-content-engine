import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getOpenAIEnv } from "@/lib/env";

export const analysisItemSchema = z.object({
  source_post_id: z.string(),
  topic: z.string(),
  hook_type: z.string(),
  format: z.string(),
  emotional_trigger: z.string(),
  response_reason: z.string(),
  structural_pattern: z.string(),
  confidence: z.number().min(0).max(1),
});

const analysisResponseSchema = z.object({
  analyses: z.array(analysisItemSchema),
});

const draftResponseSchema = z.object({
  drafts: z.array(
    z.object({
      body: z.string().min(1).max(1000),
      rationale: z.string(),
      pattern_summary: z.string(),
    }),
  ).min(1).max(5),
});

export type AnalysisInput = {
  id: string;
  text: string;
  author: string | null;
  publishedAt: string | null;
};

export type DraftSourceInput = AnalysisInput & {
  analysis: {
    topic: string;
    hook_type: string;
    format: string;
    emotional_trigger: string;
    response_reason: string;
    structural_pattern: string;
  } | null;
};

function getOpenAI() {
  return new OpenAI({ apiKey: getOpenAIEnv().OPENAI_API_KEY });
}

export async function analyzePosts(posts: AnalysisInput[]) {
  const env = getOpenAIEnv();
  const response = await getOpenAI().responses.parse({
    model: env.OPENAI_MODEL,
    reasoning: { effort: "low" },
    input: [
      {
        role: "system",
        content:
          "Analyze public Threads posts as a content strategist. Describe observable structure, not unverifiable audience demographics or causal claims. Keep the source_post_id unchanged. Identify topic, hook type, format, emotional trigger, why the post plausibly invites responses, and a reusable abstract structural pattern. Never reproduce long phrases from a source.",
      },
      {
        role: "user",
        content: JSON.stringify({ posts }),
      },
    ],
    text: {
      format: zodTextFormat(analysisResponseSchema, "threads_post_analyses"),
      verbosity: "low",
    },
  });

  if (!response.output_parsed) {
    throw new Error("OpenAI returned no structured analysis.");
  }
  return response.output_parsed.analyses;
}

export async function generateDrafts(
  sources: DraftSourceInput[],
  count = 3,
  feedback?: string,
) {
  const env = getOpenAIEnv();
  const response = await getOpenAI().responses.parse({
    model: env.OPENAI_MODEL,
    reasoning: { effort: "low" },
    input: [
      {
        role: "system",
        content:
          "Create original Threads post drafts from abstract successful patterns. Do not copy, closely paraphrase, preserve distinctive phrasing, or merely swap synonyms from any source. Use a fresh angle and wording. Do not invent personal experiences, statistics, credentials, or results. Each draft must stand alone and should invite authentic conversation. Return only the requested structured result.",
      },
      {
        role: "user",
        content: JSON.stringify({
          requested_draft_count: count,
          optional_feedback: feedback ?? null,
          sources,
        }),
      },
    ],
    text: {
      format: zodTextFormat(draftResponseSchema, "original_threads_drafts"),
      verbosity: "low",
    },
  });

  if (!response.output_parsed) {
    throw new Error("OpenAI returned no structured drafts.");
  }
  return response.output_parsed.drafts.slice(0, count);
}
