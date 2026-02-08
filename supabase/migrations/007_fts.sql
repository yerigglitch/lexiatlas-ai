alter table source_chunks
  add column if not exists content_tsv tsvector generated always as (to_tsvector('french', content)) stored;

create index if not exists source_chunks_fts_idx on source_chunks using gin (content_tsv);
