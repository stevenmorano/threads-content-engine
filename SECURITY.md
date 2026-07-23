# Security

## Supported scope

Security fixes currently target the latest code on the default branch. The project is a private, single-admin Phase 1 application and has not published a stable public release.

## Reporting a vulnerability

Do not open a public issue containing credentials, tokens, personal data, or a reproducible exploit against a live deployment. Contact the repository owner privately and include:

- the affected route, component, or dependency;
- reproduction steps with secrets removed;
- the expected and observed behavior;
- the likely impact;
- any suggested mitigation.

## Credential handling

- Keep `.env.local` out of version control. The repository ignores `.env*` except `.env.example`.
- Use the Supabase publishable key in the browser-facing variable. Never place a Supabase secret or service-role key in a `NEXT_PUBLIC_*` variable.
- Keep the Meta App Secret, Threads token-encryption key, and OpenAI API key server-side.
- Generate `THREADS_TOKEN_ENCRYPTION_KEY` as 32 random bytes encoded in Base64.
- Use different credentials for local, preview, and production environments where providers support it.
- Rotate a credential immediately if it appears in source control, logs, screenshots, chat, or issue content.

## Application boundaries

- Supabase Row Level Security and the administrator/optional reviewer allowlists enforce isolated user data boundaries.
- Stored Threads access tokens are encrypted with AES-256-GCM.
- OAuth state validation protects the Threads callback against cross-site request forgery.
- Meta deauthorization and deletion callbacks verify HMAC-SHA256 `signed_request` payloads before using the server-only Supabase secret.
- The Supabase secret key is isolated to server modules and never uses a `NEXT_PUBLIC_*` name.
- Generated drafts retain source provenance and pass a deterministic similarity gate.
- Phase 1 contains no Threads publishing or scheduling path. An approved draft remains an internal editorial state.

## Deployment checklist

- Configure the canonical `NEXT_PUBLIC_APP_URL`.
- Register the exact matching Threads OAuth callback.
- Apply the App Review migration before enabling Meta's uninstall and deletion callbacks.
- Configure a dedicated `SUPABASE_SECRET_KEY` and `PRIVACY_CONTACT_EMAIL`.
- Store secrets in Vercel environment settings, not committed files.
- Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm audit --audit-level=high`.
- Confirm Meta permissions match only the features currently deployed.
