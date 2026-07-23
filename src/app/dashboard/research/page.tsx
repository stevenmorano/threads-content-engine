import {
  Ban,
  Database,
  ExternalLink,
  Info,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import {
  createKeywordAction,
  createTopicAction,
  manualSearchAction,
  toggleKeywordAction,
} from "@/app/actions/research";
import { Notice } from "@/components/notice";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { requireAdmin } from "@/lib/auth";
import { formatDate, singleRelation } from "@/lib/format";

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const { user, supabase } = await requireAdmin();
  const params = await searchParams;
  const [
    { data: topics },
    { data: keywords },
    { data: runs },
    { data: rankedPosts },
  ] = await Promise.all([
    supabase.from("topics").select("id, name, description, is_active").eq("user_id", user.id).order("name"),
    supabase.from("research_keywords").select("id, term, kind, is_active, topic_id").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("search_runs").select("id, query, search_type, status, result_count, excluded_count, error_message, started_at").eq("user_id", user.id).order("started_at", { ascending: false }).limit(8),
    supabase.from("search_run_posts").select("id, total_score, relevance_score, recency_score, api_order_score, engagement_score, available_signals, created_at, source_posts(id, text_content, author_username, permalink, published_at), search_runs(query, search_type)").eq("user_id", user.id).order("total_score", { ascending: false }).limit(12),
  ]);

  const searchKeywords = (keywords ?? []).filter((item) => item.kind === "search");
  const exclusions = (keywords ?? []).filter((item) => item.kind === "exclude");
  const activeSearchKeywords = searchKeywords.filter((item) => item.is_active);

  return (
    <div className="page-stack">
      <header className="page-header">
        <span className="kicker">Research configuration</span>
        <h1>Shape the signal you want to find.</h1>
        <p>Organize keywords into topics, filter noise locally, and run manual searches against Meta’s official Threads API.</p>
      </header>
      <Notice success={params.success} error={params.error} />

      <section className="research-controls">
        <article className="panel">
          <div className="panel-heading">
            <div><span className="eyebrow">Discover</span><h2>Run a Threads search</h2></div>
            <Search className="panel-heading-icon" />
          </div>
          <form action={manualSearchAction} className="form-stack">
            <label className="field">
              <span>Active keyword</span>
              <select name="keywordId" required defaultValue="">
                <option value="" disabled>Select a keyword</option>
                {activeSearchKeywords.map((keyword) => (
                  <option key={keyword.id} value={keyword.id}>{keyword.term}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Meta result mode</span>
              <select name="searchType" defaultValue="TOP">
                <option value="TOP">TOP · Meta-ranked relevance</option>
                <option value="RECENT">RECENT · newest matching posts</option>
              </select>
            </label>
            <SubmitButton pendingText="Searching Threads…">Search and rank posts</SubmitButton>
          </form>
          {activeSearchKeywords.length === 0 ? (
            <p className="form-hint">Add and activate a search keyword first.</p>
          ) : null}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div><span className="eyebrow">Organize</span><h2>Add a topic</h2></div>
            <SlidersHorizontal className="panel-heading-icon" />
          </div>
          <form action={createTopicAction} className="form-stack">
            <label className="field"><span>Topic name</span><input name="name" placeholder="e.g. Product strategy" maxLength={80} required /></label>
            <label className="field"><span>Description <em>optional</em></span><textarea name="description" placeholder="What belongs in this topic?" maxLength={300} rows={3} /></label>
            <SubmitButton className="button button-secondary" pendingText="Adding…"><Plus size={16} /> Add topic</SubmitButton>
          </form>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div><span className="eyebrow">Configure</span><h2>Add a keyword</h2></div>
            <Plus className="panel-heading-icon" />
          </div>
          <form action={createKeywordAction} className="form-stack">
            <label className="field"><span>Keyword or phrase</span><input name="term" placeholder="e.g. product-led growth" maxLength={100} required /></label>
            <div className="form-row">
              <label className="field"><span>Type</span><select name="kind" defaultValue="search"><option value="search">Search</option><option value="exclude">Exclude locally</option></select></label>
              <label className="field"><span>Topic</span><select name="topicId" defaultValue=""><option value="">No topic</option>{(topics ?? []).map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label>
            </div>
            <SubmitButton className="button button-secondary" pendingText="Adding…"><Plus size={16} /> Add keyword</SubmitButton>
          </form>
        </article>
      </section>

      <section className="two-column">
        <article className="panel">
          <div className="panel-heading">
            <div><span className="eyebrow">Search set</span><h2>Keywords</h2></div>
            <span className="count-badge">{searchKeywords.length}</span>
          </div>
          <div className="chip-list">
            {searchKeywords.length ? searchKeywords.map((keyword) => (
              <form action={toggleKeywordAction} className={`config-chip ${keyword.is_active ? "" : "config-chip-off"}`} key={keyword.id}>
                <input type="hidden" name="id" value={keyword.id} />
                <input type="hidden" name="isActive" value={String(!keyword.is_active)} />
                <span><Search size={14} />{keyword.term}</span>
                <button type="submit">{keyword.is_active ? "Pause" : "Activate"}</button>
              </form>
            )) : <div className="empty-inline">No search keywords yet.</div>}
          </div>
        </article>
        <article className="panel">
          <div className="panel-heading">
            <div><span className="eyebrow">Noise filter</span><h2>Exclusions</h2></div>
            <span className="count-badge">{exclusions.length}</span>
          </div>
          <div className="chip-list">
            {exclusions.length ? exclusions.map((keyword) => (
              <form action={toggleKeywordAction} className={`config-chip config-chip-exclude ${keyword.is_active ? "" : "config-chip-off"}`} key={keyword.id}>
                <input type="hidden" name="id" value={keyword.id} />
                <input type="hidden" name="isActive" value={String(!keyword.is_active)} />
                <span><Ban size={14} />{keyword.term}</span>
                <button type="submit">{keyword.is_active ? "Pause" : "Activate"}</button>
              </form>
            )) : <div className="empty-inline">No excluded phrases yet.</div>}
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div><span className="eyebrow">Search history</span><h2>Recent runs</h2></div>
          <Database className="panel-heading-icon" />
        </div>
        {runs && runs.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Query</th><th>Mode</th><th>Status</th><th>Saved</th><th>Filtered</th><th>Started</th></tr></thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td><strong>{run.query}</strong>{run.error_message ? <small className="table-error">{run.error_message}</small> : null}</td>
                    <td><span className="mono-note">{run.search_type}</span></td>
                    <td><StatusPill status={run.status} /></td>
                    <td>{run.result_count}</td>
                    <td>{run.excluded_count}</td>
                    <td>{formatDate(run.started_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="empty-inline">No searches have run yet.</div>}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div><span className="eyebrow">Ranked discoveries</span><h2>Best recent matches</h2></div>
          <div className="help-label"><Info size={15} /> Missing public engagement is not treated as zero</div>
        </div>
        {rankedPosts && rankedPosts.length ? (
          <div className="source-grid">
            {rankedPosts.map((row) => {
              const post = singleRelation(row.source_posts);
              const run = singleRelation(row.search_runs);
              if (!post) return null;
              return (
                <article className="source-card" key={row.id}>
                  <div className="source-meta">
                    <span>@{post.author_username ?? "unknown"}</span>
                    <span>{formatDate(post.published_at)}</span>
                  </div>
                  <p>{post.text_content || "Media post with no text."}</p>
                  <div className="score-strip">
                    <strong>{Math.round(Number(row.total_score) * 100)}</strong>
                    <span>rank score</span>
                    <div><span>Rel {Math.round(Number(row.relevance_score) * 100)}</span><span>New {Math.round(Number(row.recency_score) * 100)}</span><span>API {Math.round(Number(row.api_order_score) * 100)}</span></div>
                  </div>
                  <div className="source-footer">
                    <span className="mono-note">{run?.search_type ?? "—"} · {run?.query ?? "—"}</span>
                    {post.permalink ? <a href={post.permalink} target="_blank" rel="noreferrer">Open <ExternalLink size={13} /></a> : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : <div className="empty-state"><Search size={28} /><h3>No ranked sources yet</h3><p>Connect Threads, add a keyword, and run a manual search.</p></div>}
      </section>
    </div>
  );
}
