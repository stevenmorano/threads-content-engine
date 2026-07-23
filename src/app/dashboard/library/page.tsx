import {
  BarChart3,
  CheckSquare2,
  ExternalLink,
  MessageCircleQuestion,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { analyzeSelectedAction, generateDraftsAction } from "@/app/actions/ai";
import { Notice } from "@/components/notice";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/format";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const { user, supabase } = await requireAdmin();
  const params = await searchParams;
  const [{ data: posts }, { data: analyses }, { data: scores }] = await Promise.all([
    supabase.from("source_posts").select("id, text_content, author_username, permalink, published_at, media_type, last_seen_at").eq("user_id", user.id).order("last_seen_at", { ascending: false }).limit(40),
    supabase.from("post_analyses").select("source_post_id, topic, hook_type, format, emotional_trigger, response_reason, structural_pattern, confidence, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("search_run_posts").select("source_post_id, total_score, available_signals, created_at").eq("user_id", user.id).order("total_score", { ascending: false }),
  ]);

  const latestAnalysis = new Map<string, NonNullable<typeof analyses>[number]>();
  for (const analysis of analyses ?? []) {
    if (!latestAnalysis.has(analysis.source_post_id)) {
      latestAnalysis.set(analysis.source_post_id, analysis);
    }
  }
  const bestScore = new Map<string, NonNullable<typeof scores>[number]>();
  for (const score of scores ?? []) {
    if (!bestScore.has(score.source_post_id)) bestScore.set(score.source_post_id, score);
  }

  return (
    <div className="page-stack">
      <header className="page-header page-header-split">
        <div>
          <span className="kicker">Source library</span>
          <h1>Learn from structure, not sentences.</h1>
          <p>Select up to eight sources. Analyze their mechanics, then generate drafts that use fresh language and angles.</p>
        </div>
        <div className="header-callout"><CheckSquare2 size={18} /><span>Select sources below<br /><strong>{posts?.length ?? 0} available</strong></span></div>
      </header>
      <Notice success={params.success} error={params.error} />

      <div className="info-banner">
        <MessageCircleQuestion size={20} />
        <div>
          <strong>Why are public engagement counts blank?</strong>
          <p>Meta’s documented public-post response does not expose likes, replies, reposts, or quotes. Scores here use relevance, recency, and API order and record those exact inputs.</p>
        </div>
      </div>

      {posts && posts.length ? (
        <form className="selection-form">
          <div className="sticky-actions">
            <span><strong>Select sources</strong><small>Maximum 8 per AI request</small></span>
            <div>
              <button className="button button-secondary" formAction={analyzeSelectedAction} type="submit">
                <Sparkles size={16} /> Analyze selected
              </button>
              <button className="button button-primary" formAction={generateDraftsAction} type="submit">
                <WandSparkles size={16} /> Generate 3 drafts
              </button>
            </div>
          </div>
          <div className="library-list">
            {posts.map((post) => {
              const analysis = latestAnalysis.get(post.id);
              const score = bestScore.get(post.id);
              return (
                <article className="library-card" key={post.id}>
                  <label className="source-select">
                    <input type="checkbox" name="sourceIds" value={post.id} />
                    <span aria-hidden="true" />
                    <span className="sr-only">Select post by {post.author_username ?? "unknown"}</span>
                  </label>
                  <div className="library-main">
                    <div className="source-meta">
                      <span>@{post.author_username ?? "unknown"}</span>
                      <span>{formatDate(post.published_at)}</span>
                      {post.media_type ? <span>{post.media_type}</span> : null}
                    </div>
                    <p className="source-copy">{post.text_content || "Media post with no text."}</p>
                    <div className="library-foot">
                      {score ? (
                        <span className="rank-label"><BarChart3 size={14} /><strong>{Math.round(Number(score.total_score) * 100)}</strong> rank · {score.available_signals.join(", ")}</span>
                      ) : <span className="mono-note">Not ranked</span>}
                      {post.permalink ? <a href={post.permalink} target="_blank" rel="noreferrer">View original <ExternalLink size={13} /></a> : null}
                    </div>
                  </div>
                  <aside className={analysis ? "analysis-panel" : "analysis-panel analysis-empty"}>
                    {analysis ? (
                      <>
                        <div className="analysis-top"><span>AI pattern analysis</span><strong>{Math.round(Number(analysis.confidence) * 100)}%</strong></div>
                        <dl>
                          <div><dt>Topic</dt><dd>{analysis.topic}</dd></div>
                          <div><dt>Hook</dt><dd>{analysis.hook_type}</dd></div>
                          <div><dt>Format</dt><dd>{analysis.format}</dd></div>
                          <div><dt>Emotion</dt><dd>{analysis.emotional_trigger}</dd></div>
                        </dl>
                        <div className="pattern-note"><span>Reusable pattern</span><p>{analysis.structural_pattern}</p></div>
                      </>
                    ) : (
                      <><Sparkles size={21} /><strong>Not analyzed yet</strong><p>Select this source and run an analysis.</p></>
                    )}
                  </aside>
                </article>
              );
            })}
          </div>
        </form>
      ) : (
        <div className="empty-state panel"><Sparkles size={30} /><h2>Your library is empty</h2><p>Run a manual Threads search to save your first sources.</p></div>
      )}
    </div>
  );
}
