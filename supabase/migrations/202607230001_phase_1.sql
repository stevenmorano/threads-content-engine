create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.threads_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  threads_user_id text not null,
  username text,
  access_token_ciphertext text not null,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  status text not null default 'connected'
    check (status in ('connected', 'expired', 'revoked', 'error')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index topics_user_name_unique
  on public.topics (user_id, lower(name));

create table public.research_keywords (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  term text not null check (char_length(term) between 1 and 100),
  kind text not null default 'search'
    check (kind in ('search', 'exclude')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index research_keywords_user_kind_term_unique
  on public.research_keywords (user_id, kind, lower(term));
create index research_keywords_topic_id_idx
  on public.research_keywords (topic_id);
create index research_keywords_user_active_idx
  on public.research_keywords (user_id, is_active, kind);

create table public.monitored_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  username text not null check (char_length(username) between 1 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index monitored_accounts_user_username_unique
  on public.monitored_accounts (user_id, lower(username));
create index monitored_accounts_topic_id_idx
  on public.monitored_accounts (topic_id);

create table public.search_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  keyword_id uuid references public.research_keywords(id) on delete set null,
  query text not null,
  search_type text not null check (search_type in ('TOP', 'RECENT')),
  trigger_type text not null default 'manual'
    check (trigger_type in ('manual', 'scheduled')),
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed')),
  result_count integer not null default 0 check (result_count >= 0),
  excluded_count integer not null default 0 check (excluded_count >= 0),
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index search_runs_user_started_idx
  on public.search_runs (user_id, started_at desc);
create index search_runs_keyword_id_idx
  on public.search_runs (keyword_id);

create table public.source_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  threads_post_id text not null,
  author_threads_id text,
  author_username text,
  text_content text not null default '',
  permalink text,
  media_product_type text,
  media_type text,
  shortcode text,
  is_quote_post boolean,
  has_replies boolean,
  published_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, threads_post_id)
);

create index source_posts_user_published_idx
  on public.source_posts (user_id, published_at desc);
create index source_posts_user_author_idx
  on public.source_posts (user_id, author_username);

create table public.search_run_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  search_run_id uuid not null references public.search_runs(id) on delete cascade,
  source_post_id uuid not null references public.source_posts(id) on delete cascade,
  api_position integer not null check (api_position >= 0),
  matched_terms text[] not null default '{}',
  relevance_score numeric(6, 5) not null check (relevance_score between 0 and 1),
  recency_score numeric(6, 5) not null check (recency_score between 0 and 1),
  api_order_score numeric(6, 5) not null check (api_order_score between 0 and 1),
  engagement_score numeric(6, 5),
  reply_like_score numeric(6, 5),
  total_score numeric(6, 5) not null check (total_score between 0 and 1),
  available_signals text[] not null default '{}',
  scoring_version text not null,
  created_at timestamptz not null default now(),
  unique (search_run_id, source_post_id)
);

create index search_run_posts_run_score_idx
  on public.search_run_posts (search_run_id, total_score desc);
create index search_run_posts_source_post_id_idx
  on public.search_run_posts (source_post_id);
create index search_run_posts_user_created_idx
  on public.search_run_posts (user_id, created_at desc);

create table public.engagement_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_post_id uuid not null references public.source_posts(id) on delete cascade,
  likes integer check (likes >= 0),
  replies integer check (replies >= 0),
  reposts integer check (reposts >= 0),
  quotes integer check (quotes >= 0),
  views integer check (views >= 0),
  shares integer check (shares >= 0),
  data_source text not null check (data_source in ('threads_insights', 'manual')),
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index engagement_snapshots_post_captured_idx
  on public.engagement_snapshots (source_post_id, captured_at desc);
create index engagement_snapshots_user_captured_idx
  on public.engagement_snapshots (user_id, captured_at desc);

create table public.post_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_post_id uuid not null references public.source_posts(id) on delete cascade,
  topic text not null,
  hook_type text not null,
  format text not null,
  emotional_trigger text not null,
  response_reason text not null,
  structural_pattern text not null,
  confidence numeric(4, 3) not null check (confidence between 0 and 1),
  model text not null,
  prompt_version text not null,
  created_at timestamptz not null default now()
);

create index post_analyses_source_created_idx
  on public.post_analyses (source_post_id, created_at desc);
create index post_analyses_user_created_idx
  on public.post_analyses (user_id, created_at desc);

create table public.drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'saved')),
  rationale text,
  pattern_summary text,
  max_similarity numeric(6, 5) not null check (max_similarity between 0 and 1),
  similarity_threshold numeric(6, 5) not null check (similarity_threshold between 0 and 1),
  model text not null,
  prompt_version text not null,
  generation_metadata jsonb not null default '{}'::jsonb,
  approved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index drafts_user_status_created_idx
  on public.drafts (user_id, status, created_at desc);
create index drafts_user_pending_idx
  on public.drafts (user_id, created_at desc)
  where status = 'pending';

create table public.draft_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_id uuid not null references public.drafts(id) on delete cascade,
  source_post_id uuid not null references public.source_posts(id) on delete restrict,
  similarity_score numeric(6, 5) not null check (similarity_score between 0 and 1),
  created_at timestamptz not null default now(),
  unique (draft_id, source_post_id)
);

create index draft_sources_source_post_id_idx
  on public.draft_sources (source_post_id);
create index draft_sources_user_draft_idx
  on public.draft_sources (user_id, draft_id);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_events_user_created_idx
  on public.audit_events (user_id, created_at desc);
create index audit_events_entity_idx
  on public.audit_events (entity_type, entity_id);

create trigger threads_connections_set_updated_at
  before update on public.threads_connections
  for each row execute function public.set_updated_at();
create trigger topics_set_updated_at
  before update on public.topics
  for each row execute function public.set_updated_at();
create trigger research_keywords_set_updated_at
  before update on public.research_keywords
  for each row execute function public.set_updated_at();
create trigger monitored_accounts_set_updated_at
  before update on public.monitored_accounts
  for each row execute function public.set_updated_at();
create trigger source_posts_set_updated_at
  before update on public.source_posts
  for each row execute function public.set_updated_at();
create trigger drafts_set_updated_at
  before update on public.drafts
  for each row execute function public.set_updated_at();

alter table public.threads_connections enable row level security;
alter table public.topics enable row level security;
alter table public.research_keywords enable row level security;
alter table public.monitored_accounts enable row level security;
alter table public.search_runs enable row level security;
alter table public.source_posts enable row level security;
alter table public.search_run_posts enable row level security;
alter table public.engagement_snapshots enable row level security;
alter table public.post_analyses enable row level security;
alter table public.drafts enable row level security;
alter table public.draft_sources enable row level security;
alter table public.audit_events enable row level security;

create policy threads_connections_owner on public.threads_connections
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy topics_owner on public.topics
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy research_keywords_owner on public.research_keywords
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy monitored_accounts_owner on public.monitored_accounts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy search_runs_owner on public.search_runs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy source_posts_owner on public.source_posts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy search_run_posts_owner on public.search_run_posts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy engagement_snapshots_owner on public.engagement_snapshots
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy post_analyses_owner on public.post_analyses
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy drafts_owner on public.drafts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy draft_sources_owner on public.draft_sources
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy audit_events_owner on public.audit_events
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
