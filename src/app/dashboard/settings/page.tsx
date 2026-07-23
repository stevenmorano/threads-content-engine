import {
  Check,
  ExternalLink,
  KeyRound,
  Link2,
  LockKeyhole,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Notice } from "@/components/notice";
import { StatusPill } from "@/components/status-pill";
import { requireAdmin } from "@/lib/auth";
import { getPublicEnv } from "@/lib/env";
import { formatDate } from "@/lib/format";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const { user, supabase } = await requireAdmin();
  const params = await searchParams;
  const { data: connection } = await supabase
    .from("threads_connections")
    .select("username, threads_user_id, scopes, status, token_expires_at, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;
  const requiredConfiguration = [
    ["Supabase URL", Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)],
    ["Supabase publishable key", Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)],
    ["Supabase server secret", Boolean(process.env.SUPABASE_SECRET_KEY)],
    ["Admin allowlist", Boolean(process.env.ADMIN_EMAIL)],
    ["Meta reviewer allowlist", Boolean(process.env.META_REVIEWER_EMAIL)],
    ["Privacy contact", Boolean(process.env.PRIVACY_CONTACT_EMAIL)],
    ["Threads App ID", Boolean(process.env.THREADS_APP_ID)],
    ["Threads App Secret", Boolean(process.env.THREADS_APP_SECRET)],
    ["Token encryption key", Boolean(process.env.THREADS_TOKEN_ENCRYPTION_KEY)],
    ["OpenAI API key", Boolean(process.env.OPENAI_API_KEY)],
  ] as const;

  return (
    <div className="page-stack">
      <header className="page-header">
        <span className="kicker">Connections & access</span>
        <h1>Keep every provider boundary explicit.</h1>
        <p>Phase 1 uses least-privilege Threads scopes, encrypted token storage, and server-only AI credentials.</p>
      </header>
      <Notice success={params.success} error={params.error} />

      <section className="settings-grid">
        <article className="panel connection-card">
          <div className="panel-heading">
            <div><span className="eyebrow">Meta</span><h2>Threads API</h2></div>
            <span className="provider-icon">＠</span>
          </div>
          {connection ? (
            <>
              <div className="connection-identity">
                <span className="avatar-fallback">{(connection.username ?? "T").slice(0, 1).toUpperCase()}</span>
                <div><strong>@{connection.username ?? "connected-account"}</strong><small>App-scoped ID · {connection.threads_user_id}</small></div>
                <StatusPill status={connection.status} />
              </div>
              <dl className="connection-details">
                <div><dt>Token expires</dt><dd>{formatDate(connection.token_expires_at)}</dd></div>
                <div><dt>Last updated</dt><dd>{formatDate(connection.updated_at)}</dd></div>
                <div><dt>Granted scopes</dt><dd>{connection.scopes.join(", ")}</dd></div>
              </dl>
              <a className="button button-secondary" href="/api/threads/connect"><Link2 size={16} /> Reconnect Threads</a>
            </>
          ) : (
            <>
              <div className="connect-empty"><Link2 size={26} /><strong>No Threads account connected</strong><p>Connect the one account that will authorize public keyword searches.</p></div>
              <a className="button button-primary" href="/api/threads/connect"><Link2 size={16} /> Connect with Threads</a>
            </>
          )}
          <div className="scope-note">
            <LockKeyhole size={17} />
            <p><strong>Requested now:</strong> threads_basic, threads_keyword_search. Publishing and insights permissions are intentionally absent.</p>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div><span className="eyebrow">Runtime</span><h2>Configuration check</h2></div>
            <KeyRound className="panel-heading-icon" />
          </div>
          <div className="configuration-list">
            {requiredConfiguration.map(([label, configured]) => (
              <div key={label}>
                <span className={configured ? "config-state config-good" : "config-state config-missing"}>
                  {configured ? <Check size={14} /> : <TriangleAlert size={14} />}
                </span>
                <span>{label}</span>
                <strong>{configured ? "Configured" : "Missing"}</strong>
              </div>
            ))}
          </div>
          <p className="microcopy">Values are never rendered—only presence is checked.</p>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div><span className="eyebrow">Meta setup</span><h2>OAuth and App Review checklist</h2></div>
          <ShieldCheck className="panel-heading-icon" />
        </div>
        <div className="checklist-grid">
          <div><span>1</span><p>Create a Meta app with the <strong>Threads use case</strong> and add your account as an app role/tester during development.</p></div>
          <div><span>2</span><p><strong>OAuth redirect:</strong> <code>{appUrl}/api/threads/callback</code></p></div>
          <div><span>3</span><p><strong>Uninstall callback:</strong> <code>{appUrl}/api/meta/deauthorize</code></p></div>
          <div><span>4</span><p><strong>Delete callback:</strong> <code>{appUrl}/api/meta/data-deletion</code></p></div>
          <div><span>5</span><p><strong>Privacy policy:</strong> <code>{appUrl}/privacy</code></p></div>
          <div><span>6</span><p>Request review for <code>threads_basic</code> and <code>threads_keyword_search</code> with reviewer credentials, use-case notes, and a permission-specific screen recording.</p></div>
        </div>
        <div className="link-row">
          <a className="text-link" href={`${appUrl}/privacy`} target="_blank" rel="noreferrer">Open privacy policy <ExternalLink size={14} /></a>
          <a className="text-link" href={`${appUrl}/data-deletion`} target="_blank" rel="noreferrer">Open deletion instructions <ExternalLink size={14} /></a>
          <a className="text-link" href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer">Open Meta App Dashboard <ExternalLink size={14} /></a>
        </div>
      </section>

      <section className="phase-boundary">
        <TriangleAlert size={20} />
        <div>
          <strong>Phase boundary</strong>
          <p>This build cannot publish or schedule Threads posts. “Approve” records your editorial decision only. External publishing arrives in Phase 3 with a separate permission and an explicit command path.</p>
        </div>
      </section>
    </div>
  );
}
