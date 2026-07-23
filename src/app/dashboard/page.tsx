import {
  ArrowRight,
  BookOpenText,
  CircleCheck,
  FileText,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { StatusPill } from "@/components/status-pill";
import { requireAdmin } from "@/lib/auth";

export default async function DashboardPage() {
  const { user, supabase } = await requireAdmin();
  const [
    { count: sourceCount },
    { count: analysisCount },
    { count: pendingCount },
    { count: approvedCount },
    { data: connection },
    { data: recentDrafts },
  ] = await Promise.all([
    supabase.from("source_posts").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("post_analyses").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("drafts").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "pending"),
    supabase.from("drafts").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "approved"),
    supabase.from("threads_connections").select("username, status, token_expires_at").eq("user_id", user.id).maybeSingle(),
    supabase.from("drafts").select("id, body, status, max_similarity, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(3),
  ]);

  return (
    <div className="page-stack">
      <header className="page-header page-header-split">
        <div>
          <span className="kicker">Phase 1 · research workspace</span>
          <h1>Good signals, under your control.</h1>
          <p>Discover relevant public posts, extract patterns, and review original drafts in one deliberate flow.</p>
        </div>
        <Link className="button button-primary" href="/dashboard/research">
          <Search aria-hidden="true" size={16} />
          Start a search
        </Link>
      </header>

      <section className="stats-grid" aria-label="Workspace totals">
        <article className="stat-card">
          <span className="stat-icon"><BookOpenText size={19} /></span>
          <span className="stat-value">{sourceCount ?? 0}</span>
          <span className="stat-label">Sources saved</span>
        </article>
        <article className="stat-card">
          <span className="stat-icon"><Sparkles size={19} /></span>
          <span className="stat-value">{analysisCount ?? 0}</span>
          <span className="stat-label">Pattern analyses</span>
        </article>
        <article className="stat-card">
          <span className="stat-icon"><FileText size={19} /></span>
          <span className="stat-value">{pendingCount ?? 0}</span>
          <span className="stat-label">Awaiting review</span>
        </article>
        <article className="stat-card">
          <span className="stat-icon"><CircleCheck size={19} /></span>
          <span className="stat-value">{approvedCount ?? 0}</span>
          <span className="stat-label">Approved internally</span>
        </article>
      </section>

      <section className="dashboard-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Workflow</span>
              <h2>Your research loop</h2>
            </div>
            <Radar aria-hidden="true" className="panel-heading-icon" />
          </div>
          <ol className="workflow-list">
            <li><span>01</span><div><strong>Discover</strong><p>Search TOP or RECENT posts with an active keyword.</p></div></li>
            <li><span>02</span><div><strong>Understand</strong><p>Analyze hooks, emotion, format, and response dynamics.</p></div></li>
            <li><span>03</span><div><strong>Create</strong><p>Generate fresh drafts from abstract structure, then similarity-check them.</p></div></li>
            <li><span>04</span><div><strong>Decide</strong><p>Edit, approve, reject, regenerate, or save. Nothing publishes.</p></div></li>
          </ol>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">System state</span>
              <h2>Guardrails</h2>
            </div>
            <ShieldCheck aria-hidden="true" className="panel-heading-icon" />
          </div>
          <div className="guardrail-list">
            <div><span className="state-dot state-good" /><div><strong>Manual approval only</strong><p>No publish or schedule route exists in Phase 1.</p></div></div>
            <div>
              <span className={`state-dot ${connection?.status === "connected" ? "state-good" : "state-warn"}`} />
              <div>
                <strong>{connection?.status === "connected" ? `@${connection.username ?? "Threads account"} connected` : "Threads connection needed"}</strong>
                <p>{connection?.status === "connected" ? "Least-privilege search scopes are active." : "Connect Meta before running a manual search."}</p>
              </div>
            </div>
            <div><span className="state-dot state-warn" /><div><strong>Public engagement is unavailable</strong><p>Meta does not expose public counts; ranking states which signals it used.</p></div></div>
          </div>
          <Link className="text-link" href="/dashboard/settings">Review connections <ArrowRight size={15} /></Link>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Most recent</span>
            <h2>Draft queue</h2>
          </div>
          <Link className="text-link" href="/dashboard/drafts">View all <ArrowRight size={15} /></Link>
        </div>
        {recentDrafts && recentDrafts.length > 0 ? (
          <div className="recent-list">
            {recentDrafts.map((draft) => (
              <article className="recent-row" key={draft.id}>
                <p>{draft.body}</p>
                <div>
                  <StatusPill status={draft.status} />
                  <span className="mono-note">{Math.round(Number(draft.max_similarity) * 100)}% max similarity</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-inline">No drafts yet. Save sources, then generate your first batch.</div>
        )}
      </section>
    </div>
  );
}
