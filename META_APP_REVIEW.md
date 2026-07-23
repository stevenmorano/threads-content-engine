# Meta App Review runbook

Last verified: 2026-07-23

This runbook prepares **Threads Content Engine** for review of:

- `threads_basic`
- `threads_keyword_search`

Do not request publishing, reply-management, insights, or profile-discovery permissions in this submission. Those features are not present in Phase 1.

## Current boundary

Meta's official keyword-search documentation states that an app without approval can search only posts owned by the authenticated Threads user. Public posts become searchable after `threads_keyword_search` is approved.

The application is production-deployed and the Threads OAuth connection works. Public keyword search currently returns Meta error code 10 because approval has not been granted.

## Production URLs

Replace the domain below only if the canonical Vercel domain changes.

| Meta field | URL |
| --- | --- |
| OAuth redirect | `https://threads-content-engine-six.vercel.app/api/threads/callback` |
| Uninstall callback | `https://threads-content-engine-six.vercel.app/api/meta/deauthorize` |
| Delete callback | `https://threads-content-engine-six.vercel.app/api/meta/data-deletion` |
| Privacy policy | `https://threads-content-engine-six.vercel.app/privacy` |
| Data-deletion instructions | `https://threads-content-engine-six.vercel.app/data-deletion` |

The uninstall and deletion callbacks accept Meta's `signed_request`, verify its HMAC-SHA256 signature using the Threads App Secret, and reject invalid requests. Deauthorization removes the encrypted Threads connection. Data deletion removes all workspace content associated with the connected Threads user and returns a confirmation code plus status URL.

## Required operator setup

1. Run both Supabase migrations in order:
   - `supabase/migrations/202607230001_phase_1.sql`
   - `supabase/migrations/202607230002_meta_app_review.sql`
2. In **Supabase → Settings → API Keys**, create a dedicated secret key for the Vercel backend.
3. Add it to Vercel Production as `SUPABASE_SECRET_KEY`.
4. Add a public business contact as `PRIVACY_CONTACT_EMAIL`.
5. Optionally set `APP_OPERATOR_NAME` if the policy should identify a different business/operator.
6. Redeploy and confirm the public policy and deletion pages load without authentication.
7. Replace the temporary uninstall and delete URLs in Meta with the dedicated endpoints listed above.

Never put the Supabase secret key in a `NEXT_PUBLIC_*` variable, browser code, screenshots, GitHub, or reviewer instructions.

## Dedicated reviewer account

Do not give Meta your personal administrator password.

1. In **Supabase → Authentication → Users**, create a dedicated reviewer email/password user.
2. Add that email to Vercel Production as `META_REVIEWER_EMAIL`.
3. Redeploy.
4. Verify that the reviewer can sign in but cannot see the administrator's data because every workspace row is protected by `user_id` and Row Level Security.
5. Put the reviewer email and password only in Meta's private reviewer-credentials fields.

Never commit the reviewer password or include it in a public screen recording.

## Copy-ready permission explanations

### `threads_basic`

> Threads Content Engine uses `threads_basic` to let an authorized user connect a Threads profile and to retrieve the app-scoped profile identifier, username, and display name required to associate searches with that user. The authorization code and token exchange happen server-side. The long-lived Threads token is encrypted before storage and is never sent to the browser. This permission is required by all Threads API requests used by the app.

### `threads_keyword_search`

> Threads Content Engine is a private research and editorial workspace. An authorized user creates a keyword and manually runs either a TOP or RECENT search against the official Threads `/v1.0/keyword_search` endpoint. The app saves returned public posts and documented metadata, filters excluded terms, and ranks the results using relevance, recency, and Meta result order. Selected sources can later support original AI-assisted drafts with source provenance and similarity checks. The app does not scrape Threads and Phase 1 has no publishing, scheduling, advertising, or automated search path.

## Reviewer steps

1. Open the production `/login` page.
2. Sign in with the dedicated credentials supplied privately in the review form.
3. Open **Connections**.
4. Select **Connect with Threads** and complete the Threads authorization flow.
5. Confirm that the connection page shows `threads_basic` and `threads_keyword_search`.
6. Open **Research**.
7. Add a non-sensitive search keyword.
8. Select TOP or RECENT and choose **Search and rank posts**.
9. Confirm that results are saved to the ranked discoveries/source library.
10. Open a saved result to demonstrate how the returned Threads data is used.

If Meta's review account requires a specific country, login step, or test profile, add those details to the private reviewer notes before submission.

## Screen-recording checklist

- Record the production deployment, not localhost.
- Start logged out and show the complete application login.
- Show the full Threads OAuth and consent flow.
- Make both requested permission names visible.
- Demonstrate a keyword search through the application.
- Show the returned data inside the application and how it supports the stated research use case.
- Keep all secrets, passwords, tokens, environment variables, and Supabase keys out of the recording.
- Use readable resolution and normal speed.
- Make the recording accessible to Meta reviewers through the submission form.

## Pre-submission verification

- [ ] Both Supabase migrations are applied.
- [ ] `SUPABASE_SECRET_KEY` is configured only in Vercel Production.
- [ ] `PRIVACY_CONTACT_EMAIL` is configured.
- [ ] `META_REVIEWER_EMAIL` and its Supabase user are configured.
- [ ] Privacy and deletion pages load publicly.
- [ ] OAuth, uninstall, and delete URLs are exact and use HTTPS.
- [ ] Reviewer login works with the supplied credentials.
- [ ] Only `threads_basic` and `threads_keyword_search` are requested.
- [ ] Permission descriptions match the deployed functionality.
- [ ] Screen recording shows the complete end-to-end flow.
- [ ] App dashboard requirements such as business verification are complete if Meta displays them.

Meta changes dashboard labels and review gates independently of endpoint documentation. Recheck the live **App Review / Permissions and Features** screen immediately before submission.
