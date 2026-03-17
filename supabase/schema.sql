create table if not exists public.studio_documents (
  owner_user_id text primary key,
  document jsonb not null,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.studio_documents enable row level security;

-- Server-side service-role access is used for phase 2 persistence.
-- End-user clients should not write this table directly.
