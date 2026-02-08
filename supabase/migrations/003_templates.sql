create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  storage_path text not null,
  placeholders jsonb,
  created_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  template_id uuid references templates(id) on delete set null,
  title text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

alter table templates enable row level security;
alter table documents enable row level security;

create policy "Templates are tenant-owned" on templates
  for all using (tenant_id in (select tenant_id from profiles where id = auth.uid()))
  with check (tenant_id in (select tenant_id from profiles where id = auth.uid()));

create policy "Documents are tenant-owned" on documents
  for all using (tenant_id in (select tenant_id from profiles where id = auth.uid()))
  with check (tenant_id in (select tenant_id from profiles where id = auth.uid()));

create index if not exists templates_tenant_idx on templates(tenant_id);
create index if not exists documents_tenant_idx on documents(tenant_id);
