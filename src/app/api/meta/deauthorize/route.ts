import { NextRequest, NextResponse } from "next/server";
import { getThreadsEnv } from "@/lib/env";
import { parseMetaSignedRequest } from "@/lib/meta/signed-request";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    endpoint: "Threads Content Engine deauthorization callback",
    method: "POST",
    authentication: "Meta signed_request",
  });
}

export async function POST(request: NextRequest) {
  let threadsUserId: string;
  try {
    const formData = await request.formData();
    const signedRequest = formData.get("signed_request");
    if (typeof signedRequest !== "string") {
      return NextResponse.json({ error: "signed_request is required" }, { status: 400 });
    }
    threadsUserId = parseMetaSignedRequest(
      signedRequest,
      getThreadsEnv().THREADS_APP_SECRET,
    ).user_id;
  } catch {
    return NextResponse.json({ error: "Invalid signed_request" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("threads_connections")
      .delete()
      .eq("threads_user_id", threadsUserId);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Meta deauthorization callback failed.", error);
    return NextResponse.json(
      { error: "Could not complete deauthorization" },
      { status: 500 },
    );
  }
}
