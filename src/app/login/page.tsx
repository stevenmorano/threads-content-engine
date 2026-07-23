import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions/auth";
import { Brand } from "@/components/brand";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { getAdminUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getAdminUser()) redirect("/dashboard");
  const params = await searchParams;

  return (
    <main className="login-shell">
      <section className="login-story">
        <Brand />
        <div>
          <span className="kicker">Research → pattern → original draft</span>
          <h1>Find the signal.<br />Keep your voice.</h1>
          <p>
            A private workspace for learning from public Threads posts without
            copying them—and without publishing anything you have not approved.
          </p>
        </div>
        <div className="guardrail-card">
          <span className="guardrail-icon" aria-hidden="true">✓</span>
          <div>
            <strong>Manual approval is structural</strong>
            <p>Phase 1 has no publishing endpoint. Approval stays inside this workspace.</p>
          </div>
        </div>
      </section>
      <section className="login-panel">
        <div className="login-form-wrap">
          <span className="eyebrow">Private admin access</span>
          <h2>Welcome back</h2>
          <p className="muted">Use an authorized account created in Supabase.</p>
          <Notice error={params.error} />
          <form action={loginAction} className="form-stack">
            <label className="field">
              <span>Email</span>
              <input autoComplete="email" name="email" type="email" required />
            </label>
            <label className="field">
              <span>Password</span>
              <input autoComplete="current-password" name="password" type="password" minLength={8} required />
            </label>
            <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
          </form>
          <p className="microcopy">
            Public signup is disabled. Access is limited by the administrator
            and optional Meta reviewer allowlists.
          </p>
          <p className="microcopy">
            <a className="text-link" href="/privacy">Privacy policy</a>
            {" · "}
            <a className="text-link" href="/data-deletion">Data deletion</a>
          </p>
        </div>
      </section>
    </main>
  );
}
