import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { errorMessage, messageUrl } from "@/lib/errors";
import { getPublicEnv } from "@/lib/env";
import { exchangeCodeForLongLivedToken } from "@/lib/threads/client";

export async function GET(request: NextRequest) {
  const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.redirect(new URL("/login", appUrl));
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("threads_oauth_state")?.value;
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const oauthError = request.nextUrl.searchParams.get("error_message");
  cookieStore.delete("threads_oauth_state");

  if (oauthError) {
    return NextResponse.redirect(
      new URL(messageUrl("/dashboard/settings", "error", oauthError), appUrl),
    );
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(
      new URL(
        messageUrl("/dashboard/settings", "error", "OAuth state validation failed."),
        appUrl,
      ),
    );
  }

  try {
    const token = await exchangeCodeForLongLivedToken(code);
    const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();
    const { error } = await admin.supabase.from("threads_connections").upsert(
      {
        user_id: admin.user.id,
        threads_user_id: token.userId,
        username: token.profile.username ?? null,
        access_token_ciphertext: encryptSecret(token.access_token),
        token_expires_at: expiresAt,
        scopes: ["threads_basic", "threads_keyword_search"],
        status: "connected",
        last_error: null,
      },
      { onConflict: "user_id" },
    );
    if (error) throw error;

    await admin.supabase.from("audit_events").insert({
      user_id: admin.user.id,
      event_type: "threads_connected",
      entity_type: "threads_connection",
      metadata: { username: token.profile.username ?? null },
    });

    return NextResponse.redirect(
      new URL(
        messageUrl("/dashboard/settings", "success", "Threads account connected."),
        appUrl,
      ),
    );
  } catch (error) {
    return NextResponse.redirect(
      new URL(messageUrl("/dashboard/settings", "error", errorMessage(error)), appUrl),
    );
  }
}
