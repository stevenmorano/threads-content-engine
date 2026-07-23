import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url().transform((value) => value.replace(/\/$/, "")),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const adminSchema = z.object({
  ADMIN_EMAIL: z.email(),
});

const threadsSchema = z.object({
  THREADS_APP_ID: z.string().min(1),
  THREADS_APP_SECRET: z.string().min(1),
  THREADS_TOKEN_ENCRYPTION_KEY: z.string().min(1),
});

const openAISchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().min(1).default("gpt-5.6-terra"),
  DRAFT_SIMILARITY_THRESHOLD: z.coerce.number().min(0.3).max(0.95).default(0.72),
});

export function getPublicEnv() {
  return publicSchema.parse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

export function getServerEnv() {
  return {
    ...getPublicEnv(),
    ...getAdminEnv(),
    ...getThreadsEnv(),
    ...getOpenAIEnv(),
  };
}

export function getAdminEnv() {
  return adminSchema.parse({ ADMIN_EMAIL: process.env.ADMIN_EMAIL });
}

export function getThreadsEnv() {
  return threadsSchema.parse({
    THREADS_APP_ID: process.env.THREADS_APP_ID,
    THREADS_APP_SECRET: process.env.THREADS_APP_SECRET,
    THREADS_TOKEN_ENCRYPTION_KEY: process.env.THREADS_TOKEN_ENCRYPTION_KEY,
  });
}

export function getOpenAIEnv() {
  return openAISchema.parse({
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    DRAFT_SIMILARITY_THRESHOLD: process.env.DRAFT_SIMILARITY_THRESHOLD,
  });
}

export function getSupabaseEnv() {
  return publicSchema.pick({
    NEXT_PUBLIC_SUPABASE_URL: true,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: true,
  }).parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
