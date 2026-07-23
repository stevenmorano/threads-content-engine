# Changelog

All notable project changes are recorded here. This project follows a phased product roadmap rather than semantic-versioned public releases during initial development.

## Unreleased

### Fixed

- Send the short-lived Threads user token through Meta's required `access_token` parameter when exchanging it for a long-lived token.
- Limit keyword-search fields to Meta's documented public-search response fields and explain permission code 10 as an App Review/testing restriction.

### Tests

- Added a Threads OAuth regression test that verifies the exact long-lived-token request shape.
- Added regression coverage for keyword-search field selection and permission-error messaging.
- Added Vitest path-alias configuration matching the Next.js and TypeScript project aliases.

## 0.1.0 — 2026-07-23

### Added

- Next.js 16 App Router application with TypeScript and Tailwind CSS.
- One-admin Supabase email/password authentication with an `ADMIN_EMAIL` allowlist.
- Postgres schema, indexes, constraints, triggers, and Row Level Security policies.
- Topic, search-keyword, and excluded-keyword management.
- Official Threads OAuth start/callback flow with CSRF protection and encrypted token storage.
- Manual `TOP` and `RECENT` keyword-search integration.
- Source persistence, deduplication, auditable ranking, and nullable engagement signals.
- Structured OpenAI source analysis and original-draft generation.
- Deterministic lexical similarity checks with source-level provenance.
- Draft edit, regenerate, approve, reject, and save-for-later workflows.
- Overview, research, source library, draft approval, and connections pages.
- Unit tests for ranking and similarity behavior.

### Security

- Publishing and scheduling are structurally absent from Phase 1.
- Provider secrets remain server-side.
- Threads tokens use AES-256-GCM encryption at rest.
- No Supabase secret or service-role key is required by the Phase 1 web application.

### Verified

- Supabase migration applied successfully.
- Local admin authentication and RLS-backed writes verified.
- All dashboard routes verified.
- Lint, TypeScript, six unit tests, production build, and high-severity dependency audit pass.

### Remaining operator setup

- Meta app credentials and Threads test-account authorization.
- Threads token-encryption key generation.
- OpenAI API key.
- Vercel deployment and production OAuth callback registration.
