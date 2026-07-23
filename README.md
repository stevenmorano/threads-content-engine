# Threads Content Engine

A private Threads research workspace for one administrator, with an optional isolated reviewer account during Meta App Review. Phase 1 connects to Meta's official Threads API, searches public posts by keyword after Meta approval, stores and ranks discoveries, analyzes selected sources with OpenAI, generates original drafts, checks similarity, and holds every draft for manual review.

Nothing in Phase 1 can publish or schedule a Threads post.

## What is implemented

- Supabase email/password authentication with an `ADMIN_EMAIL` allowlist
- Row Level Security on all application tables
- Threads OAuth authorization-code flow with CSRF state validation
- AES-256-GCM encryption for the stored long-lived Threads token
- Search and excluded-keyword management, grouped by optional topics
- Manual `TOP` and `RECENT` searches using `GET /keyword_search`
- Deduplicated source storage and auditable rank components
- Structured OpenAI analysis and draft generation through the Responses API
- Deterministic lexical similarity gate with source-level scores
- Source provenance for every draft
- Edit, regenerate, approve, reject, and save-for-later actions
- Audit events for material workflow changes
- Signed Meta deauthorization and data-deletion callbacks
- Public privacy policy, deletion instructions, and deletion-status pages
- Optional dedicated reviewer-email allowlist

The research findings, API support matrix, architecture, schema rationale, phased roadmap, complete environment list, and Meta review notes are in [PROJECT_BLUEPRINT.md](./PROJECT_BLUEPRINT.md). The submission checklist and copy-ready reviewer text are in [META_APP_REVIEW.md](./META_APP_REVIEW.md).

## Current setup status

Verified on 2026-07-23:

- the Phase 1 database migration has been applied to Supabase;
- the one-admin Supabase user and email allowlist are configured;
- local Supabase authentication, RLS-backed topic/keyword writes, and all dashboard routes work;
- the Supabase project URL and publishable key are configured locally;
- production OAuth connects `@adhdsteve` with the intended least-privilege scopes;
- Meta's unapproved public-search boundary is surfaced as an actionable error;
- lint, TypeScript, twelve unit tests, the production build, and the high-severity dependency audit pass.

Still required before the full Phase 1 workflow can run:

- apply the App Review migration and configure the server-only Supabase secret;
- configure the privacy contact and optional dedicated reviewer account;
- submit `threads_basic` and `threads_keyword_search` for Meta App Review;
- add an OpenAI API key after application-side usage limits are configured.

See [CHANGELOG.md](./CHANGELOG.md) for the implementation history and [SECURITY.md](./SECURITY.md) for credential and reporting guidance.

## Important Meta API limitation

The official public keyword-search and media-object field lists do not expose numeric likes, replies, reposts, or quotes for arbitrary public posts. The post-insights endpoint documents those metrics for the authenticated user's own posts.

Threads Content Engine therefore:

- stores engagement metrics as nullable values;
- never treats unavailable counts as zero;
- ranks third-party discoveries using relevance, recency, and Meta API result order;
- records the exact signals used with each score;
- reserves authenticated-account insights for the later performance phase.

## Prerequisites

- Node.js 20.9 or newer
- A Supabase project
- A Meta Developer account and Meta app with the Threads use case
- A Threads account added as an app role/tester while the Meta app is in development
- An OpenAI API project with billing enabled
- A Vercel account for deployment

## 1. Install

```powershell
npm install
Copy-Item .env.example .env.local
```

Generate the token-encryption key:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Put the result in `THREADS_TOKEN_ENCRYPTION_KEY`.

## 2. Configure Supabase

1. Create a Supabase project.
2. Open the SQL editor and run these migrations in order:
   - [`supabase/migrations/202607230001_phase_1.sql`](./supabase/migrations/202607230001_phase_1.sql)
   - [`supabase/migrations/202607230002_meta_app_review.sql`](./supabase/migrations/202607230002_meta_app_review.sql)
3. In **Authentication → Providers → Email**, enable email/password authentication.
4. In **Authentication → Users**, create the one administrator manually.
5. Set `ADMIN_EMAIL` to that exact email address.
6. Set `NEXT_PUBLIC_APP_URL=http://localhost:3000` for local development.
7. Copy the project URL and publishable key into:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Public signup is not exposed by the application.

For Meta callbacks, create a dedicated `sb_secret_...` key in **Supabase → Settings → API Keys** and store it only as the server-side `SUPABASE_SECRET_KEY`. It bypasses RLS and must never be exposed to the browser.

## 3. Configure the Meta Threads app

1. Create a Meta app with the **Threads use case**.
2. Add the administrator's Threads account as an app role/tester for development.
3. Add the exact redirect URI:

```text
http://localhost:3000/api/threads/callback
```

4. For production, add:

```text
https://YOUR-DOMAIN/api/threads/callback
```

5. Put the Threads App ID and App Secret into `.env.local`.
6. Phase 1 requests only:
   - `threads_basic`
   - `threads_keyword_search`

Do not request publishing or insights permissions until those later phases ship.

For production use outside app roles, plan Meta App Review/advanced access for each requested permission. Confirm the exact requirements in **App Review → Permissions and Features**, and prepare a privacy policy, data-deletion instructions, reviewer account, use-case narrative, and permission-specific screen recording.

Use [META_APP_REVIEW.md](./META_APP_REVIEW.md) for the exact production URLs, reviewer steps, permission explanations, and recording checklist.

## 4. Configure OpenAI

Set `OPENAI_API_KEY`. `OPENAI_MODEL` defaults to `gpt-5.6-terra`, selected as the current quality/cost-balanced model in official model guidance. It remains an environment variable so it can be changed after representative evaluations.

The integration uses structured outputs with the Responses API. No OpenAI key or provider response is sent to the browser.

## 5. Run locally

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in, then open **Connections** to authorize Threads.

## First-use workflow

1. Open **Research** and create an internal topic.
2. Add one or more search keywords and optional excluded keywords.
3. Open **Connections** and connect the authorized Threads account.
4. Run a manual `TOP` or `RECENT` keyword search.
5. Review and select saved posts in **Source library**.
6. Analyze selected sources, then generate original drafts.
7. Review each result in **Draft approvals** and edit, regenerate, approve, reject, or save it.

Approval is internal bookkeeping in Phase 1. It does not publish, schedule, or transmit the draft to Threads.

## Environment variables

| Name | Required | Browser-visible |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Yes | Yes |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Yes |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Yes |
| `SUPABASE_SECRET_KEY` | App Review callbacks | No |
| `ADMIN_EMAIL` | Yes | No |
| `META_REVIEWER_EMAIL` | App Review | No |
| `PRIVACY_CONTACT_EMAIL` | App Review | No |
| `APP_OPERATOR_NAME` | Optional | No |
| `THREADS_APP_ID` | Yes | No |
| `THREADS_APP_SECRET` | Yes | No |
| `THREADS_TOKEN_ENCRYPTION_KEY` | Yes | No |
| `OPENAI_API_KEY` | Yes | No |
| `OPENAI_MODEL` | Optional | No |
| `DRAFT_SIMILARITY_THRESHOLD` | Optional | No |

The Supabase publishable key is intentionally browser-safe; normal database access is enforced through authenticated sessions and RLS. The Supabase secret key is restricted to HMAC-verified Meta callbacks and server-rendered deletion-status lookups.

## Validation

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm audit --audit-level=high
```

Unit tests cover missing-signal ranking behavior, engagement-aware ranking, similarity detection, Threads OAuth/search request shapes, and Meta signed-request verification.

## Troubleshooting

### A page shows a development error overlay

Confirm `.env.local` is inside the project folder:

```text
threads-research-studio/.env.local
```

It must not be saved beside the folder as `threads-research-studio.env.local`, and Windows Notepad must not append `.txt`.

The Connections page requires `NEXT_PUBLIC_APP_URL`, even before Meta is configured:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Restart `npm run dev` after changing environment variables.

### Connections reports missing providers

The configuration list intentionally checks presence without rendering values. Supabase should show as configured after local setup. Threads and OpenAI remain missing until their respective variables are added to `.env.local`.

### Public posts have no engagement counts

This is an official API limitation, not a failed search. Arbitrary public keyword-search results do not document numeric engagement fields. The app preserves those values as unavailable and uses its fallback ranking model.

## Deploy to Vercel

1. Import the project into Vercel.
2. Add every Phase 1 environment variable to the Production and appropriate Preview environments.
3. Set `NEXT_PUBLIC_APP_URL` to the canonical deployment origin.
4. Add the matching production callback URI in the Meta app.
5. Deploy and complete the Threads connection from the production app.

Vercel Cron is deliberately absent in Phase 1. The Phase 2 plan adds secured cron routes, idempotent jobs, token refresh, and scheduled keyword/account monitoring.

## Phase boundary

An `approved` draft is an editorial state only. There is no create-container call, publish call, schedule table, cron publishing worker, or hidden outbound action in this codebase. Publishing arrives only in Phase 3 after a separate permission, explicit approval command, and idempotent delivery design are added.
