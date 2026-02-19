create table if not exists email_templates_v2 (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  name text not null,
  description text,
  subject_template text not null,
  body_template text not null,
  variables jsonb not null default '[]'::jsonb,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists email_templates_v2_tenant_name_unique_active_idx
  on email_templates_v2(tenant_id, lower(name))
  where is_archived = false;
create index if not exists email_templates_v2_tenant_idx on email_templates_v2(tenant_id);

create table if not exists email_drafts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  template_id uuid references email_templates_v2(id) on delete set null,
  title text not null,
  to_recipients jsonb not null default '[]'::jsonb,
  cc_recipients jsonb not null default '[]'::jsonb,
  bcc_recipients jsonb not null default '[]'::jsonb,
  subject text not null,
  body_html text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'failed')),
  last_error text,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_drafts_tenant_status_idx on email_drafts(tenant_id, status);
create index if not exists email_drafts_tenant_updated_idx on email_drafts(tenant_id, updated_at desc);

create table if not exists email_send_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  draft_id uuid not null references email_drafts(id) on delete cascade,
  recipient_email text not null,
  message_id text,
  status text not null check (status in ('sent', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

create index if not exists email_send_events_tenant_created_idx on email_send_events(tenant_id, created_at desc);
create index if not exists email_send_events_tenant_recipient_idx on email_send_events(tenant_id, recipient_email);

alter table email_templates_v2 enable row level security;
alter table email_drafts enable row level security;
alter table email_send_events enable row level security;

create policy "Email templates v2 are tenant-owned" on email_templates_v2
  for all using (tenant_id in (select tenant_id from profiles where id = auth.uid()))
  with check (tenant_id in (select tenant_id from profiles where id = auth.uid()));

create policy "Email drafts are tenant-owned" on email_drafts
  for all using (tenant_id in (select tenant_id from profiles where id = auth.uid()))
  with check (tenant_id in (select tenant_id from profiles where id = auth.uid()));

create policy "Email send events are tenant-owned" on email_send_events
  for all using (tenant_id in (select tenant_id from profiles where id = auth.uid()))
  with check (tenant_id in (select tenant_id from profiles where id = auth.uid()));

create or replace function set_updated_at_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists email_templates_v2_updated_at on email_templates_v2;
create trigger email_templates_v2_updated_at
before update on email_templates_v2
for each row
execute function set_updated_at_timestamp();

drop trigger if exists email_drafts_updated_at on email_drafts;
create trigger email_drafts_updated_at
before update on email_drafts
for each row
execute function set_updated_at_timestamp();
