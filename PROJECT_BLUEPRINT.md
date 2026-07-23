# Threads Content Engine — Product and Technical Blueprint

Last verified: 2026-07-23

The interface, repository, Supabase project, Meta app, and documentation use **Threads Content Engine**.

## Understanding summary

- Build a private, single-admin research workspace for discovering public Threads posts, analyzing reusable patterns, and drafting original posts.
- Phase 1 includes Supabase authentication, research keyword management, manual official-API searches, persistence, ranking, AI analysis/generation, similarity checks, and a manual approval dashboard.
- Phase 1 never publishes or schedules content. Approval states are internal workflow states only.
- The system must use documented official API fields and retain provenance from every draft back to its source posts.
- The initial operating scale is one administrator, tens of keywords, hundreds to low thousands of discovered posts, and low-volume on-demand AI calls.
- Security defaults include server-only provider secrets, encrypted Threads tokens, Supabase Row Level Security (RLS), an admin email allowlist, and audit events.
- Explicit Phase 1 non-goals: scheduled discovery, automatic publishing, publishing-now, scheduling, Telegram, automated performance sync, and advanced analytics.

## Implementation checkpoint

As of 2026-07-23, the Phase 1 application code, database migrations, one-admin authentication, research configuration, manual search transport, persistence/ranking, AI analysis/generation, similarity gate, source provenance, approval dashboard, and Meta App Review callback/policy package are implemented.

Supabase authentication, Vercel deployment, the Meta app, and the Threads OAuth connection have been verified. Public keyword search is blocked until Meta approves `threads_keyword_search`, as documented by Meta. The App Review migration, server-only Supabase secret, privacy contact, reviewer account, review submission, and OpenAI usage controls remain operator steps.

## Verified Threads API capabilities

Meta's verified official Postman workspace is treated as an official, current API reference because the Meta-hosted developer documentation returned rate-limit errors during research.

| Requirement | Current official support | Phase 1 decision |
| --- | --- | --- |
| OAuth connection | Supported with authorization code exchange, short-lived token, long-lived token exchange, and token refresh. | Implement authorization start/callback and encrypted long-lived token storage. |
| Public keyword search | Supported by `GET /keyword_search` with `q`, `search_type=TOP|RECENT`, `limit`, and documented media fields. Requires `threads_keyword_search`. | Implement manual TOP/RECENT search. |
| Public post retrieval | Supported with documented media-object fields including ID, text, username/owner, permalink, timestamp, media type, quote/repost relationships, attachments, and related metadata. | Persist only requested, documented fields plus the raw response for forward compatibility. |
| Exact-account monitoring | Supported by `GET /profile_posts?username=...`; the username must be an exact match. The current official collection lists `threads_profile_discovery`. | Schema now; UI and scheduled monitoring in Phase 2. |
| Public post engagement counts | **Not documented as public media-object fields.** The current keyword-search and post-detail field lists do not contain like, reply, repost, or quote counts. | Keep metrics nullable. Never infer or scrape them. Rank third-party discoveries using relevance, recency, and API result order. |
| Post insights | Supported by `GET /{threads-media-id}/insights` for views, likes, replies, reposts, quotes, and shares; official examples describe these as metrics on “your post.” Requires `threads_manage_insights`. | Use later for the connected admin's published posts; do not call it for arbitrary public discoveries. |
| Publishing | Supported as a create-container then publish flow with `threads_content_publish`. | Deliberately excluded from Phase 1. No publish endpoint or action exists in the Phase 1 app. |

Primary references:

- [Meta's official Threads API workspace](https://www.postman.com/meta/threads/overview)
- [Official keyword search request](https://www.postman.com/meta/threads/request/m9j4i2x/search-for-threads-posts)
- [Official public profile posts request](https://www.postman.com/meta/threads/request/34203612-116161fc-75af-4a09-a972-66d6f64ddb10)
- [Official post insights request](https://www.postman.com/meta/threads/request/34203612-385abc7d-b3cc-4e5d-9937-ebbe7174e041)
- [Official authorization collection](https://www.postman.com/meta/threads/folder/34203612-e0373e84-de6b-46f1-b90d-3fea76ba6782)
- [Official code-to-token exchange](https://www.postman.com/meta/threads/request/34203612-32805431-ab3c-4480-9312-67cfd63f7ba7)
- [Official long-lived token exchange](https://www.postman.com/meta/threads/request/34203612-e19a804d-ed93-45cd-82f8-7b8110a60744)

## Product limitations to communicate

1. A numeric “high performing across public Threads” score cannot be fully reproduced with the official API today because public search results do not expose the required engagement counts.
2. `TOP` search is a useful Meta-ranked discovery mode, but its ranking formula is opaque and is not a substitute for numeric engagement data.
3. Reply-to-like ratio is available only when both metrics are legitimately present—principally for the connected user's own posts through insights.
4. Exact-account monitoring is supported, but Phase 1 omits its management screen and schedules by design.
5. Topics are an internal organizing concept. Meta's endpoint is keyword search; the app maps keywords to optional internal topics.
6. Excluded keywords are applied locally after the official search response.
7. Automatic performance learning, publishing, and scheduling are later phases.

## Architecture

### Recommended approach

Use a single Next.js App Router deployment with server-rendered pages, Server Actions for authenticated mutations, and route handlers only where protocol callbacks are required.

```text
Browser
  -> Next.js App Router on Vercel
       -> Supabase Auth (cookie-based SSR)
       -> Supabase Postgres (RLS-protected application data)
       -> Meta Threads OAuth + graph.threads.net (server only)
       -> OpenAI Responses API (server only)
```

Boundaries:

- React Server Components read data close to the page.
- Server Actions validate input, re-check the admin session, mutate through the authenticated Supabase client, and revalidate affected routes.
- OAuth route handlers own state-cookie validation and token exchange.
- Provider credentials and decrypted Threads tokens never enter Client Components.
- Domain modules isolate ranking, similarity, Threads transport, token encryption, OpenAI structured outputs, and validation.

Alternatives considered:

1. A separate worker/API service: stronger isolation for high-volume jobs, but unnecessary operational overhead for a one-user manual Phase 1.
2. n8n as the initial orchestrator: useful for scheduled Phase 2 workflows, but it would split core business logic and complicate local testing now.

## Ranking model

The ranking function accepts all requested signals as nullable inputs.

When engagement is available:

```text
score = 0.35 relevance
      + 0.20 recency
      + 0.30 normalized engagement
      + 0.15 reply-to-like conversation score
```

Engagement is a log-scaled weighted blend of likes, replies, reposts, and quotes. Recency uses exponential decay. Reply-to-like ratio is bounded to prevent a tiny denominator from dominating.

When engagement is unavailable for a public discovery:

```text
score = 0.55 relevance
      + 0.30 recency
      + 0.15 API-order score
```

Every stored rank records the scoring version and which inputs were available. A score is therefore auditable and never presents missing metrics as zero.

## Similarity control

Before a generated draft is saved, normalize draft and source text and calculate:

- word-bigram Jaccard similarity;
- character-trigram Jaccard similarity;
- longest shared phrase pressure.

The highest blended source score is retained on the draft-source join. Drafts above the configured threshold are rejected by the application and must be regenerated. This deterministic Phase 1 check is intentionally conservative and testable; embeddings and semantic near-copy checks can be added after real false-positive/negative evaluation data exists.

## Database schema

All user-owned tables include `user_id uuid references auth.users(id)`, have RLS enabled, and use policies scoped with `(select auth.uid())`. Foreign keys and common filter/sort paths are indexed.

| Table | Purpose and important columns |
| --- | --- |
| `threads_connections` | One encrypted Threads OAuth connection per admin: app-scoped Threads user ID, username, ciphertext, expiry, scopes, connection status. |
| `topics` | Internal topic name, description, active flag. |
| `research_keywords` | Search or exclusion term, optional topic, active flag, timestamps. Unique per user/type/case-insensitive term. |
| `monitored_accounts` | Future exact-username monitoring configuration; no Phase 1 UI. |
| `search_runs` | Immutable manual/future scheduled execution record: keyword, TOP/RECENT, status, errors, counts, timing. |
| `source_posts` | Deduplicated Threads media objects with documented typed fields, raw payload, first/last seen timestamps. |
| `search_run_posts` | Join with API position, matched terms, component scores, total score, scoring version, and signal availability. |
| `engagement_snapshots` | Nullable likes/replies/reposts/quotes/views/shares with collection time and explicit source. Intended for the admin's own post insights later. |
| `post_analyses` | Structured AI analysis: topic, hook, format, emotional trigger, response rationale, reusable pattern, model/prompt version. |
| `drafts` | Body, status, generation metadata, max similarity, threshold, model/prompt version, timestamps. |
| `draft_sources` | Provenance join between each draft and every source, including per-source similarity. |
| `audit_events` | Append-only action history for connection, search, analysis, generation, edit, approval, rejection, and save-later events. |
| `meta_data_deletion_requests` | Non-user-linked deletion receipt with a random confirmation code, hashed Threads identifier, status, and timestamps. Accessible only through the server-side secret. |

Draft status is constrained to `pending`, `approved`, `rejected`, and `saved`. There is deliberately no `published` or `scheduled` transition in Phase 1.

## Phased implementation

### Phase 1 — manual research and approval

- One-admin Supabase email/password authentication and allowlist.
- Threads OAuth connection with least-privilege Phase 1 scopes.
- Database migration with RLS, indexes, constraints, and triggers.
- Topic plus search/exclusion keyword management.
- Manual TOP/RECENT keyword search, local exclusions, deduplication, and auditable ranking.
- Source post library and post selection.
- Structured OpenAI analysis and original draft generation.
- Deterministic similarity gate and source provenance.
- Draft edit, regenerate, approve, reject, and save-later actions.
- No outbound Threads publishing code.

### Phase 2 — scheduled research

- Account monitoring through exact-username profile retrieval.
- Scheduled searches using secured Vercel Cron routes or n8n.
- Idempotent job leasing, retry policy, rate-limit handling, and token refresh.
- Research digests and improved search-run observability.

### Phase 3 — manually approved publishing

- Add `threads_content_publish` only when shipping publishing.
- “Approve and publish now” and “approve and schedule” become separate, auditable commands.
- Re-authentication/confirmation before external writes.
- Idempotency keys, container status checks, and failure recovery.
- The invariant remains: no publish job exists until a human approval event exists.

### Phase 4 — performance feedback

- Add `threads_manage_insights`.
- Sync post/account insights only for the connected user's content.
- Track performance snapshots and compare recommendation patterns against outcomes.
- Calibrate weights and recommendations from the user's own data without claiming causal certainty.

## Required external accounts

1. Meta Developer account and a Meta app created with the Threads use case.
2. A public Threads account authorized as an app role/tester during development.
3. Supabase project with email/password authentication enabled.
4. OpenAI API project with billing and an API key.
5. Vercel account/project for deployment.
6. Optional in Phase 2: n8n Cloud or a self-hosted n8n instance.

## Environment variables

### Required in Phase 1

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Browser-safe | Canonical origin used to build the exact OAuth callback URL. |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser-safe | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe | Supabase publishable key; authorization still relies on RLS. |
| `SUPABASE_SECRET_KEY` | Server only | Dedicated `sb_secret_...` key used only by verified Meta callbacks and deletion-status rendering. |
| `ADMIN_EMAIL` | Server only | Case-insensitive allowlist for the single administrator. |
| `META_REVIEWER_EMAIL` | Server only | Optional dedicated reviewer login; receives an isolated RLS-scoped workspace. |
| `PRIVACY_CONTACT_EMAIL` | Server-rendered public text | Public business contact required on the privacy/deletion pages before review. |
| `APP_OPERATOR_NAME` | Server-rendered public text | Optional operator/business name shown in the privacy policy. |
| `THREADS_APP_ID` | Server only | Meta Threads App ID. |
| `THREADS_APP_SECRET` | Server only | Meta Threads App Secret. |
| `THREADS_TOKEN_ENCRYPTION_KEY` | Server only | Base64-encoded 32-byte key for AES-256-GCM token encryption. |
| `OPENAI_API_KEY` | Server only | OpenAI project key. |
| `OPENAI_MODEL` | Server only | Model override; recommended initial default is `gpt-5.6-terra` for quality/cost balance. |
| `DRAFT_SIMILARITY_THRESHOLD` | Server only | Optional; defaults to `0.72`. |

### Later phases

| Variable | Phase | Purpose |
| --- | --- | --- |
| `CRON_SECRET` | 2 | Protect Vercel Cron route invocations. |
| `N8N_WEBHOOK_SECRET` | 2, optional | Authenticate n8n-triggered jobs. |

Authenticated RLS-scoped requests remain the default. The `SUPABASE_SECRET_KEY` bypasses RLS and is isolated to server-only modules for HMAC-verified Meta callbacks and opaque deletion-status receipts. It is never sent to the browser.

## Meta setup, permissions, and review

Phase 1 requests only:

- `threads_basic`
- `threads_keyword_search`

Later, request permissions only when their features ship:

- `threads_profile_discovery` for exact-account monitoring
- `threads_content_publish` for publishing
- `threads_manage_insights` for the connected user's performance sync

The app must configure the exact development and production OAuth redirect URIs. The authorization code is exchanged server-side, then exchanged for a long-lived token; unexpired long-lived tokens need refresh handling in Phase 2.

Meta's app roles/test users can be used while the app is in development mode. Production access for people outside app roles should be planned around Meta App Review/advanced access for each requested permission. Prepare:

- a reachable privacy policy and data-deletion instructions;
- a reviewer login/test account;
- a clear written use-case explanation;
- a screen recording showing the complete permission-specific flow;
- successful API calls for each requested permission;
- business or technology-provider verification if the Meta dashboard requires it for the account/use case.

Implemented production endpoints:

- OAuth redirect: `/api/threads/callback`
- deauthorization callback: `/api/meta/deauthorize`
- data-deletion callback: `/api/meta/data-deletion`
- privacy policy: `/privacy`
- deletion instructions: `/data-deletion`
- opaque deletion status: `/data-deletion/status/{confirmationCode}`

Both Meta callbacks verify the HMAC-SHA256 `signed_request` using the Threads App Secret. Deauthorization removes the encrypted connection. Data deletion calls a service-role-only Postgres function that atomically deletes all workspace rows associated with the connected Threads account while retaining the Supabase login record to prevent accidental lockout.

Because Meta changes review gates and dashboard wording independently of endpoint documentation, confirm the exact checklist shown in the app's **App Review → Permissions and Features** screen immediately before submission.

## OpenAI decision

Use the Responses API with structured JSON output, server-side only. Current official model guidance lists `gpt-5.6-sol` as the flagship, `gpt-5.6-terra` for balanced intelligence/cost, and `gpt-5.6-luna` for cost-sensitive volume. Phase 1 defaults to Terra through configuration and uses low reasoning for bounded classification/generation.

References:

- [Official model guidance](https://developers.openai.com/api/docs/guides/latest-model)
- [Official model catalog](https://developers.openai.com/api/docs/models)

## Operational assumptions

- One administrator is created manually in Supabase Auth; public signup is not exposed.
- English-language source posts and drafts are the initial target.
- Manual search requests are low volume and executed one keyword at a time.
- Provider outages return clear actionable errors and preserve failed run records.
- Source content is retained for provenance until the admin deletes the project data.
- Availability target is best-effort personal tooling, not a formal SLA.
- Maintenance is owned by the account holder; migrations and provider API changes are reviewed before production deployment.

## Decision log

| Decision | Alternatives | Why |
| --- | --- | --- |
| Next.js monolith for Phase 1 | Separate API/worker; n8n-first | Lowest operational burden while preserving clean domain boundaries. |
| Supabase Auth + RLS | Custom auth; service-role-only backend | Production-grade session handling and database-enforced isolation without custom credential code. |
| Least-privilege Threads scopes | Request all future permissions now | Easier review, lower risk, and matches shipped functionality. |
| Nullable engagement metrics | Scrape visible counts; store fake zeroes | Official API compliance and honest scoring. |
| Deterministic lexical similarity gate | Embeddings immediately | Testable, explainable, and no extra vector infrastructure before real evaluation data. |
| OpenAI structured outputs | Free-form JSON prompting | Stronger runtime contract and simpler persistence validation. |
| No publish code in Phase 1 | Hide a disabled publish endpoint | Makes accidental external posting structurally impossible. |
