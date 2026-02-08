alter table rag_citations
  add column if not exists source_title text;
