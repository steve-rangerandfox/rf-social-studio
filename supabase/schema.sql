create table if not exists public.studio_documents (
  owner_user_id text primary key,
  document jsonb not null,
  version integer not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  -- Guard against unbounded document growth
  constraint document_size_limit check (octet_length(document::text) <= 2097152)
);

-- Indexes for common query patterns
create index if not exists idx_studio_documents_updated_at
  on public.studio_documents (updated_at desc);

create index if not exists idx_studio_documents_created_at
  on public.studio_documents (created_at desc);

-- Auto-update updated_at on row modification
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at
  before update on public.studio_documents
  for each row
  execute function public.update_updated_at_column();

-- Row-Level Security
alter table public.studio_documents enable row level security;

-- Security model: this table is accessed exclusively via the server-side
-- Supabase client using the service_role key. The anon (public) key must
-- never be able to read or write rows. End-user clients do not interact
-- with this table directly; all access is mediated by authenticated API
-- endpoints in the Node server.

create policy "Service role has full access"
  on public.studio_documents
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Deny anonymous access"
  on public.studio_documents
  for all
  using (auth.role() != 'anon')
  with check (auth.role() != 'anon');

-- Distributed rate limiting table
create table if not exists public.rate_limits (
  key text primary key,
  count integer not null default 1,
  window_start timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null
);

-- Auto-cleanup expired entries
create index if not exists idx_rate_limits_expires
  on public.rate_limits (expires_at);

-- Composite index for user document lookups
create index if not exists idx_studio_documents_user_updated
  on public.studio_documents (owner_user_id, updated_at desc);
