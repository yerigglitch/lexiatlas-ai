create table if not exists user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  rag_settings jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table user_preferences enable row level security;

create policy "User preferences are user-owned" on user_preferences
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists user_preferences_tenant_idx on user_preferences(tenant_id);
