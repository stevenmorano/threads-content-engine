import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicPolicyLayout } from "@/components/public-policy-layout";
import { formatDate } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Deletion request status",
};

const statusTitles = {
  processing: "Deletion in progress",
  completed: "Deletion completed",
  failed: "Deletion needs attention",
} as const;

export default async function DataDeletionStatusPage({
  params,
}: {
  params: Promise<{ confirmationCode: string }>;
}) {
  const { confirmationCode } = await params;
  const supabase = createAdminClient();
  const { data: request } = await supabase
    .from("meta_data_deletion_requests")
    .select("confirmation_code, status, requested_at, completed_at")
    .eq("confirmation_code", confirmationCode)
    .maybeSingle();

  if (!request) notFound();

  return (
    <PublicPolicyLayout
      eyebrow="Deletion status"
      title={statusTitles[request.status as keyof typeof statusTitles] ?? "Deletion status"}
      intro="This page confirms the status of a Meta data-deletion request."
    >
      <dl className="policy-status">
        <div><dt>Confirmation code</dt><dd><code>{request.confirmation_code}</code></dd></div>
        <div><dt>Status</dt><dd>{request.status}</dd></div>
        <div><dt>Requested</dt><dd>{formatDate(request.requested_at)}</dd></div>
        <div><dt>Completed</dt><dd>{formatDate(request.completed_at)}</dd></div>
      </dl>
    </PublicPolicyLayout>
  );
}
