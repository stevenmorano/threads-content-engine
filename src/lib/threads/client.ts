import { z } from "zod";
import { getPublicEnv, getThreadsEnv } from "@/lib/env";
import {
  threadsSearchResponseSchema,
  type ThreadsSearchType,
} from "@/lib/threads/types";

const API_BASE = "https://graph.threads.net";
const AUTH_BASE = "https://threads.net/oauth/authorize";
const MEDIA_FIELDS = [
  "id",
  "media_product_type",
  "media_type",
  "permalink",
  "owner",
  "username",
  "text",
  "timestamp",
  "shortcode",
  "is_quote_post",
  "quoted_post",
  "reposted_post",
  "has_replies",
  "alt_text",
  "link_attachment_url",
].join(",");

const shortTokenSchema = z.object({
  access_token: z.string(),
  user_id: z.union([z.string(), z.number()]).transform(String),
});

const longTokenSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
});

const profileSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  username: z.string().optional(),
  name: z.string().optional(),
});

async function readApiResponse(response: Response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? JSON.stringify(body.error)
        : `HTTP ${response.status}`;
    throw new Error(`Threads API request failed: ${message}`);
  }
  return body;
}

export function getThreadsAuthorizationUrl(state: string) {
  const threadsEnv = getThreadsEnv();
  const redirectUri = `${getPublicEnv().NEXT_PUBLIC_APP_URL}/api/threads/callback`;
  const params = new URLSearchParams({
    client_id: threadsEnv.THREADS_APP_ID,
    redirect_uri: redirectUri,
    scope: "threads_basic,threads_keyword_search",
    response_type: "code",
    state,
  });
  return `${AUTH_BASE}?${params.toString()}`;
}

export async function exchangeCodeForLongLivedToken(code: string) {
  const threadsEnv = getThreadsEnv();
  const redirectUri = `${getPublicEnv().NEXT_PUBLIC_APP_URL}/api/threads/callback`;
  const shortParams = new URLSearchParams({
    client_id: threadsEnv.THREADS_APP_ID,
    client_secret: threadsEnv.THREADS_APP_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const shortResponse = await fetch(`${API_BASE}/oauth/access_token?${shortParams}`, {
    method: "POST",
    cache: "no-store",
  });
  const shortToken = shortTokenSchema.parse(await readApiResponse(shortResponse));

  const longParams = new URLSearchParams({
    grant_type: "th_exchange_token",
    client_secret: threadsEnv.THREADS_APP_SECRET,
    access_token: shortToken.access_token,
  });
  const longResponse = await fetch(`${API_BASE}/access_token?${longParams}`, {
    cache: "no-store",
  });
  const longToken = longTokenSchema.parse(await readApiResponse(longResponse));

  const profileParams = new URLSearchParams({ fields: "id,username,name" });
  const profileResponse = await fetch(`${API_BASE}/me?${profileParams}`, {
    headers: { Authorization: `Bearer ${longToken.access_token}` },
    cache: "no-store",
  });
  const profile = profileSchema.parse(await readApiResponse(profileResponse));

  return {
    ...longToken,
    userId: shortToken.user_id,
    profile,
  };
}

export async function searchThreads(
  accessToken: string,
  query: string,
  searchType: ThreadsSearchType,
  limit = 50,
) {
  const params = new URLSearchParams({
    q: query,
    search_type: searchType,
    limit: String(limit),
    fields: MEDIA_FIELDS,
  });
  const response = await fetch(`${API_BASE}/keyword_search?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  return threadsSearchResponseSchema.parse(await readApiResponse(response));
}
