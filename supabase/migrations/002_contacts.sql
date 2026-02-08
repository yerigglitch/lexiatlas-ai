create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  email text,
  phone text,
  organization text,
  role text,
  notes text,
  created_at timestamptz not null default now()
);

alter table contacts enable row level security;

create policy "Contacts are tenant-owned" on contacts
  for all using (tenant_id in (select tenant_id from profiles where id = auth.uid()))
  with check (tenant_id in (select tenant_id from profiles where id = auth.uid()));

create index if not exists contacts_tenant_idx on contacts(tenant_id);
