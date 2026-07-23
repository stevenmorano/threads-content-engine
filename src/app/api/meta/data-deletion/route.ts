import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPublicEnv, getThreadsEnv } from "@/lib/env";
import { parseMetaSignedRequest } from "@/lib/meta/signed-request";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function deletionResponse(confirmationCode: string) {
  const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;
  return {
    url: `${appUrl}/data-deletion/status/${confirmationCode}`,
    confirmation_code: confirmationCode,
  };
}

export function GET() {
  return NextResponse.json({
    endpoint: "Threads Content Engine data-deletion callback",
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

  const threadsUserHash = createHash("sha256").update(threadsUserId).digest("hex");
  let confirmationCode: string | null = null;

  try {
    const supabase = createAdminClient();
    const { data: previousRequest, error: previousError } = await supabase
      .from("meta_data_deletion_requests")
      .select("confirmation_code")
      .eq("threads_user_hash", threadsUserHash)
      .eq("status", "completed")
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (previousError) throw previousError;
    if (previousRequest) {
      return NextResponse.json(deletionResponse(previousRequest.confirmation_code));
    }

    confirmationCode = randomUUID();
    const { error: requestError } = await supabase
      .from("meta_data_deletion_requests")
      .insert({
        confirmation_code: confirmationCode,
        threads_user_hash: threadsUserHash,
        status: "processing",
      });
    if (requestError) throw requestError;

    const { data: connection, error: connectionError } = await supabase
      .from("threads_connections")
      .select("user_id")
      .eq("threads_user_id", threadsUserId)
      .maybeSingle();
    if (connectionError) throw connectionError;

    if (connection) {
      const { error: deletionError } = await supabase.rpc(
        "delete_threads_content_engine_user_data",
        { target_user_id: connection.user_id },
      );
      if (deletionError) throw deletionError;
    }

    const { error: completionError } = await supabase
      .from("meta_data_deletion_requests")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("confirmation_code", confirmationCode);
    if (completionError) throw completionError;

    return NextResponse.json(deletionResponse(confirmationCode));
  } catch (error) {
    console.error("Meta data-deletion callback failed.", error);
    if (confirmationCode) {
      try {
        await createAdminClient()
          .from("meta_data_deletion_requests")
          .update({
            status: "failed",
            error_message: "Deletion failed; see protected server logs.",
          })
          .eq("confirmation_code", confirmationCode);
      } catch (statusError) {
        console.error("Could not record Meta data-deletion failure.", statusError);
      }
    }
    return NextResponse.json(
      { error: "Could not complete data deletion" },
      { status: 500 },
    );
  }
}
