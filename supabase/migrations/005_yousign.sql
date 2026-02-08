create table if not exists yousign_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  environment text not null default 'sandbox',
  encrypted_api_key text,
  legal_name text,
  from_email text,
  created_at timestamptz not null default now()
);

create table if not exists signature_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  document_id uuid references documents(id) on delete set null,
  yousign_request_id text,
  status text not null default 'draft',
  signer_name text,
  signer_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table yousign_settings enable row level security;
alter table signature_requests enable row level security;

create policy "Yousign settings are tenant-owned" on yousign_settings
  for all using (tenant_id in (select tenant_id from profiles where id = auth.uid()))
  with check (tenant_id in (select tenant_id from profiles where id = auth.uid()));

create policy "Signature requests are tenant-owned" on signature_requests
  for all using (tenant_id in (select tenant_id from profiles where id = auth.uid()))
  with check (tenant_id in (select tenant_id from profiles where id = auth.uid()));

create index if not exists yousign_settings_tenant_idx on yousign_settings(tenant_id);
create index if not exists signature_requests_tenant_idx on signature_requests(tenant_id);
