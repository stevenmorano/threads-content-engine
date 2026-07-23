import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { getThreadsAuthorizationUrl } from "@/lib/threads/client";

export async function GET(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const state = randomUUID();
  const cookieStore = await cookies();
  cookieStore.set("threads_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(getThreadsAuthorizationUrl(state));
}
