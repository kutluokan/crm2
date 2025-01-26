create or replace function match_documents(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  ticket_id uuid
)
returns table (
  id uuid,
  content text,
  filename text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    documents.id,
    documents.content,
    documents.filename,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where 
    documents.ticket_id = match_documents.ticket_id
    and 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$; 