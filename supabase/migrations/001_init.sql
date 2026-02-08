-- LexiAtlas AI MVP schema
-- Requires pgvector extension

create extension if not exists vector;
create extension if not exists pgcrypto;

-- Tenants (cabinets)
create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Profiles are linked to auth.users
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  full_name text,
  role text not null default 'member',
  created_at timestamptz not null default now()
);

-- Store per-user API key (encrypted in app layer; here it's just text)
create table if not exists user_api_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'openai',
  encrypted_key text not null,
  created_at timestamptz not null default now()
);

-- Sources uploaded by the cabinet
create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  source_type text not null default 'upload',
  storage_path text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

-- Chunks with embeddings
create table if not exists source_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sources(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  content text not null,
  content_tsv tsvector generated always as (to_tsvector('french', content)) stored,
  embedding vector(1024),
  token_count int,
  created_at timestamptz not null default now()
);

create index if not exists source_chunks_tenant_idx on source_chunks(tenant_id);
create index if not exists source_chunks_source_idx on source_chunks(source_id);
create index if not exists source_chunks_embedding_idx on source_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists source_chunks_fts_idx on source_chunks using gin (content_tsv);

-- Similarity search helper
create or replace function match_source_chunks(
  query_embedding vector(1024),
  match_count int,
  tenant_id uuid
)
returns table (
  id uuid,
  source_id uuid,
  content text,
  score float
)
language sql
stable
as $$
  select
    source_chunks.id,
    source_chunks.source_id,
    source_chunks.content,
    1 - (source_chunks.embedding <=> query_embedding) as score
  from source_chunks
  where source_chunks.tenant_id = match_source_chunks.tenant_id
  order by source_chunks.embedding <=> query_embedding
  limit match_count;
$$;

-- Queries & answers
create table if not exists rag_queries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  question text not null,
  answer text,
  created_at timestamptz not null default now()
);

create table if not exists rag_citations (
  id uuid primary key default gen_random_uuid(),
  query_id uuid not null references rag_queries(id) on delete cascade,
  source_id uuid not null references sources(id) on delete cascade,
  chunk_id uuid references source_chunks(id) on delete set null,
  snippet text,
  score numeric,
  created_at timestamptz not null default now()
);

-- Audit log
create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);

-- RLS
alter table tenants enable row level security;
alter table profiles enable row level security;
alter table user_api_keys enable row level security;
alter table sources enable row level security;
alter table source_chunks enable row level security;
alter table rag_queries enable row level security;
alter table rag_citations enable row level security;
alter table audit_events enable row level security;

-- Policies
create policy "Tenants are visible to members" on tenants
  for select using (exists (
    select 1 from profiles p where p.tenant_id = tenants.id and p.id = auth.uid()
  ));

create policy "Profiles are visible to tenant" on profiles
  for select using (tenant_id in (select tenant_id from profiles where id = auth.uid()));

create policy "Profiles are insertable by user" on profiles
  for insert with check (id = auth.uid());

create policy "User API key is user-owned" on user_api_keys
  for select using (user_id = auth.uid());

create policy "User API key insert/update" on user_api_keys
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Sources are tenant-owned" on sources
  for all using (tenant_id in (select tenant_id from profiles where id = auth.uid()))
  with check (tenant_id in (select tenant_id from profiles where id = auth.uid()));

create policy "Chunks are tenant-owned" on source_chunks
  for all using (tenant_id in (select tenant_id from profiles where id = auth.uid()))
  with check (tenant_id in (select tenant_id from profiles where id = auth.uid()));

create policy "RAG queries are tenant-owned" on rag_queries
  for all using (tenant_id in (select tenant_id from profiles where id = auth.uid()))
  with check (tenant_id in (select tenant_id from profiles where id = auth.uid()));

create policy "Citations are tenant-owned" on rag_citations
  for all using (
    exists (
      select 1 from rag_queries q
      where q.id = rag_citations.query_id
        and q.tenant_id in (select tenant_id from profiles where id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from rag_queries q
      where q.id = rag_citations.query_id
        and q.tenant_id in (select tenant_id from profiles where id = auth.uid())
    )
  );

create policy "Audit events are tenant-owned" on audit_events
  for select using (tenant_id in (select tenant_id from profiles where id = auth.uid()));
