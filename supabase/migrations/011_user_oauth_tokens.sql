create table if not exists user_oauth_tokens (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  encrypted_access_token text not null,
  encrypted_refresh_token text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table user_oauth_tokens enable row level security;

create policy "User oauth tokens are user-owned" on user_oauth_tokens
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());
