create table if not exists smtp_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  host text not null,
  port int not null,
  username text not null,
  encrypted_password text not null,
  from_name text,
  from_email text,
  created_at timestamptz not null default now()
);

create table if not exists email_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  to_email text not null,
  subject text not null,
  status text not null,
  error text,
  created_at timestamptz not null default now()
);

alter table smtp_settings enable row level security;
alter table email_logs enable row level security;

create policy "SMTP settings are tenant-owned" on smtp_settings
  for all using (tenant_id in (select tenant_id from profiles where id = auth.uid()))
  with check (tenant_id in (select tenant_id from profiles where id = auth.uid()));

create policy "Email logs are tenant-owned" on email_logs
  for all using (tenant_id in (select tenant_id from profiles where id = auth.uid()))
  with check (tenant_id in (select tenant_id from profiles where id = auth.uid()));

create index if not exists smtp_settings_tenant_idx on smtp_settings(tenant_id);
create index if not exists email_logs_tenant_idx on email_logs(tenant_id);
