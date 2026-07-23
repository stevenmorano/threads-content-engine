import {
  Archive,
  Check,
  ExternalLink,
  PenLine,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import {
  editDraftAction,
  regenerateDraftAction,
  updateDraftStatusAction,
} from "@/app/actions/drafts";
import { Notice } from "@/components/notice";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { requireAdmin } from "@/lib/auth";
import { formatDate, singleRelation } from "@/lib/format";

export default async function DraftsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const { user, supabase } = await requireAdmin();
  const params = await searchParams;
  const { data: drafts } = await supabase
    .from("drafts")
    .select("id, body, status, rationale, pattern_summary, max_similarity, similarity_threshold, model, created_at, draft_sources(similarity_score, source_posts(id, author_username, text_content, permalink))")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="page-stack">
      <header className="page-header page-header-split">
        <div>
          <span className="kicker">Draft approval dashboard</span>
          <h1>Every draft waits for you.</h1>
          <p>Edit, regenerate, reject, save, or approve internally. In Phase 1, approval never sends content to Threads.</p>
        </div>
        <div className="approval-lock"><ShieldCheck size={20} /><span><strong>No auto-publishing</strong><small>Not implemented by design</small></span></div>
      </header>
      <Notice success={params.success} error={params.error} />

      {drafts && drafts.length ? (
        <div className="draft-list">
          {drafts.map((draft) => (
            <article className="draft-card" key={draft.id}>
              <div className="draft-topline">
                <div><StatusPill status={draft.status} /><span className="mono-note">{formatDate(draft.created_at)} · {draft.model}</span></div>
                <div className="similarity-meter">
                  <span>Similarity</span>
                  <strong>{Math.round(Number(draft.max_similarity) * 100)}%</strong>
                  <span className="meter-track"><span style={{ width: `${Math.max(3, Number(draft.max_similarity) * 100)}%` }} /></span>
                  <small>limit {Math.round(Number(draft.similarity_threshold) * 100)}%</small>
                </div>
              </div>

              <form action={editDraftAction} className="draft-editor">
                <input type="hidden" name="draftId" value={draft.id} />
                <label>
                  <span className="sr-only">Draft text</span>
                  <textarea name="body" defaultValue={draft.body} maxLength={1000} rows={5} required />
                </label>
                <SubmitButton className="button button-quiet" pendingText="Checking and saving…"><PenLine size={15} /> Save edit</SubmitButton>
              </form>

              <div className="draft-context">
                <div><span className="eyebrow">Pattern used</span><p>{draft.pattern_summary ?? "No pattern summary saved."}</p></div>
                <div><span className="eyebrow">Why this draft</span><p>{draft.rationale ?? "No generation rationale saved."}</p></div>
              </div>

              <details className="source-details">
                <summary>View {draft.draft_sources?.length ?? 0} connected source{draft.draft_sources?.length === 1 ? "" : "s"}</summary>
                <div className="draft-source-list">
                  {(draft.draft_sources ?? []).map((link) => {
                    const source = singleRelation(link.source_posts);
                    if (!source) return null;
                    return (
                      <div key={`${draft.id}-${source.id}`}>
                        <span><strong>@{source.author_username ?? "unknown"}</strong> · {Math.round(Number(link.similarity_score) * 100)}% similarity</span>
                        <p>{source.text_content}</p>
                        {source.permalink ? <a href={source.permalink} target="_blank" rel="noreferrer">Original <ExternalLink size={12} /></a> : null}
                      </div>
                    );
                  })}
                </div>
              </details>

              <div className="draft-actions">
                <form action={updateDraftStatusAction}>
                  <input type="hidden" name="draftId" value={draft.id} />
                  <input type="hidden" name="status" value="approved" />
                  <SubmitButton className="button button-approve" pendingText="Approving…"><Check size={16} /> Approve</SubmitButton>
                </form>
                <form action={updateDraftStatusAction}>
                  <input type="hidden" name="draftId" value={draft.id} />
                  <input type="hidden" name="status" value="saved" />
                  <SubmitButton className="button button-secondary" pendingText="Saving…"><Archive size={16} /> Save for later</SubmitButton>
                </form>
                <form action={updateDraftStatusAction}>
                  <input type="hidden" name="draftId" value={draft.id} />
                  <input type="hidden" name="status" value="rejected" />
                  <SubmitButton className="button button-danger-quiet" pendingText="Rejecting…"><X size={16} /> Reject</SubmitButton>
                </form>
              </div>

              <form action={regenerateDraftAction} className="regenerate-form">
                <input type="hidden" name="draftId" value={draft.id} />
                <label className="field"><span>Regeneration direction <em>optional</em></span><input name="feedback" maxLength={500} placeholder="e.g. Make it more direct and less list-like" /></label>
                <SubmitButton className="button button-secondary" pendingText="Generating replacement…"><RefreshCcw size={16} /> Regenerate</SubmitButton>
              </form>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state panel"><Sparkles size={30} /><h2>No drafts yet</h2><p>Select sources in the library and generate an original batch.</p></div>
      )}
    </div>
  );
}
