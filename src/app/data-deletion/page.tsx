import type { Metadata } from "next";
import { PublicPolicyLayout } from "@/components/public-policy-layout";
import { getPrivacyEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "Data deletion",
  description: "Data-deletion instructions for Threads Content Engine.",
};

export default function DataDeletionPage() {
  const { PRIVACY_CONTACT_EMAIL } = getPrivacyEnv();

  return (
    <PublicPolicyLayout
      eyebrow="Your data"
      title="Data-deletion instructions"
      intro="You can remove the Threads connection or request deletion of the workspace data associated with it."
    >
      <h2>Request through Meta or Threads</h2>
      <ol>
        <li>Open the connected-app or website-permissions area in your Meta or Threads settings.</li>
        <li>Select <strong>Threads Content Engine</strong>.</li>
        <li>Remove access and choose the data-deletion option when it is offered.</li>
      </ol>
      <p>
        Meta will send a signed request to our deletion endpoint. After it is
        verified, the application removes the associated connection, research
        settings, saved posts, analyses, drafts, and audit history. Meta receives
        a confirmation code and a status URL.
      </p>

      <h2>Request by email</h2>
      {PRIVACY_CONTACT_EMAIL ? (
        <p>
          Email{" "}
          <a href={`mailto:${PRIVACY_CONTACT_EMAIL}?subject=Threads%20Content%20Engine%20data%20deletion`}>
            {PRIVACY_CONTACT_EMAIL}
          </a>{" "}
          from your authorized account with the subject “Threads Content Engine
          data deletion.” We may ask for enough information to verify ownership
          before deleting data.
        </p>
      ) : (
        <p>
          The public deletion-contact address is not configured yet. Set{" "}
          <code>PRIVACY_CONTACT_EMAIL</code> before App Review.
        </p>
      )}

      <h2>What remains</h2>
      <p>
        The Supabase authentication record is retained so a deletion request
        does not lock the authorized administrator out of the application. It
        contains the login email but no Threads access token or researched
        content. You may request deletion of that authentication record by
        email.
      </p>
    </PublicPolicyLayout>
  );
}
