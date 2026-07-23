create table public.meta_data_deletion_requests (
  confirmation_code uuid primary key default gen_random_uuid(),
  threads_user_hash text not null,
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'failed')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  error_message text
);

create index meta_data_deletion_requests_hash_requested_idx
  on public.meta_data_deletion_requests (threads_user_hash, requested_at desc);

alter table public.meta_data_deletion_requests enable row level security;
revoke all on table public.meta_data_deletion_requests from anon, authenticated;
grant select, insert, update on table public.meta_data_deletion_requests to service_role;

create or replace function public.delete_threads_content_engine_user_data(
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.draft_sources where user_id = target_user_id;
  delete from public.drafts where user_id = target_user_id;
  delete from public.post_analyses where user_id = target_user_id;
  delete from public.engagement_snapshots where user_id = target_user_id;
  delete from public.search_run_posts where user_id = target_user_id;
  delete from public.source_posts where user_id = target_user_id;
  delete from public.search_runs where user_id = target_user_id;
  delete from public.monitored_accounts where user_id = target_user_id;
  delete from public.research_keywords where user_id = target_user_id;
  delete from public.topics where user_id = target_user_id;
  delete from public.audit_events where user_id = target_user_id;
  delete from public.threads_connections where user_id = target_user_id;
end;
$$;

revoke all on function public.delete_threads_content_engine_user_data(uuid)
  from public, anon, authenticated;
grant execute on function public.delete_threads_content_engine_user_data(uuid)
  to service_role;
