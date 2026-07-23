import type { Metadata } from "next";
import { PublicPolicyLayout } from "@/components/public-policy-layout";
import { getPrivacyEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "Privacy policy for Threads Content Engine.",
};

export default function PrivacyPage() {
  const { APP_OPERATOR_NAME, PRIVACY_CONTACT_EMAIL } = getPrivacyEnv();

  return (
    <PublicPolicyLayout
      eyebrow="Privacy"
      title="Privacy policy"
      intro={`This policy explains how ${APP_OPERATOR_NAME} handles information in Threads Content Engine.`}
    >
      <p><strong>Effective date:</strong> July 23, 2026</p>

      <h2>Information we process</h2>
      <p>
        We process the administrator or reviewer email used for authentication,
        an app-scoped Threads user identifier, Threads username, encrypted
        Threads access token, configured research keywords and topics, public
        Threads posts returned by authorized searches, generated analyses and
        drafts, and security or audit records created by the application.
      </p>

      <h2>How we use information</h2>
      <p>
        Information is used only to authenticate authorized users, connect the
        selected Threads profile, search and rank relevant public content,
        analyze selected patterns, generate original drafts, prevent close
        copying, and maintain an approval history. Phase 1 cannot publish or
        schedule content.
      </p>

      <h2>Service providers</h2>
      <p>
        The application uses Meta for the Threads API, Supabase for
        authentication and database storage, and Vercel for hosting. When AI
        features are configured and deliberately used, selected source text and
        generation instructions are sent to OpenAI. We do not sell personal
        information or use it to purchase advertising.
      </p>

      <h2>Storage and security</h2>
      <p>
        Threads access tokens are encrypted before storage. Provider secrets
        remain server-side. Database access is protected by authenticated
        sessions and row-level security; Meta callbacks must carry a valid
        signature before privileged deletion operations can run.
      </p>

      <h2>Retention and deletion</h2>
      <p>
        Workspace information is retained until it is deleted, is no longer
        needed for the application, or the connected user submits a valid data
        deletion request. Deauthorization removes the stored Threads
        connection. A verified deletion request removes the connection,
        research configuration, saved source posts, analyses, drafts, and audit
        history tied to that workspace.
      </p>

      <h2>Your choices</h2>
      <p>
        You may disconnect the Threads application through Meta or Threads
        settings. You may also follow the{" "}
        <a href="/data-deletion">data-deletion instructions</a>.
      </p>

      <h2>Contact</h2>
      {PRIVACY_CONTACT_EMAIL ? (
        <p>
          Privacy questions may be sent to{" "}
          <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a>.
        </p>
      ) : (
        <p>
          A public privacy contact is being configured. Do not submit this page
          to App Review until <code>PRIVACY_CONTACT_EMAIL</code> is set.
        </p>
      )}
    </PublicPolicyLayout>
  );
}
