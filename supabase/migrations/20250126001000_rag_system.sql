-- Enable the pgvector extension to work with embeddings
create extension if not exists vector;

-- Create a table for storing documents
create table documents (
    id uuid primary key default gen_random_uuid(),
    ticket_id uuid references tickets(id),
    filename text not null,
    content text,
    metadata jsonb,
    embedding vector(1536),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create a function to update updated_at timestamp if it doesn't exist
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language plpgsql;

-- Create trigger for documents
create trigger update_documents_updated_at
    before update on documents
    for each row
    execute function update_updated_at_column();

-- Create a storage bucket for document files
insert into storage.buckets (id, name, public) 
values ('documents', 'documents', false);

-- Enable RLS on documents table
alter table documents enable row level security;

-- Policies for documents table
create policy "Users can view their own ticket documents"
    on documents for select
    using (
        auth.uid() in (
            select customer_id from tickets where id = documents.ticket_id
            union
            select assigned_to from tickets where id = documents.ticket_id
        )
    );

create policy "Users can insert documents for their tickets"
    on documents for insert
    with check (
        auth.uid() in (
            select customer_id from tickets where id = documents.ticket_id
            union
            select assigned_to from tickets where id = documents.ticket_id
        )
    );

-- Storage policies
create policy "Users can upload documents"
    on storage.objects for insert
    with check (
        bucket_id = 'documents' and
        auth.role() = 'authenticated'
    );

create policy "Users can view their documents"
    on storage.objects for select
    using (
        bucket_id = 'documents' and
        auth.role() = 'authenticated'
    );

-- Add delete policies for documents
create policy "Support and admin can delete any document"
    on documents for delete
    using (
        exists (
            select 1 from profiles
            where id = auth.uid()
            and (role = 'support' or role = 'admin')
        )
    );

create policy "Customers can delete their own ticket documents"
    on documents for delete
    using (
        exists (
            select 1 from tickets
            where id = documents.ticket_id
            and customer_id = auth.uid()
        )
    );

-- Create a function to match documents based on embedding similarity
create or replace function match_documents(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    documents.id,
    documents.content,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Add delete policies for ticket messages
create policy "Support and admin can delete any message"
    on ticket_messages for delete
    using (
        exists (
            select 1 from profiles
            where id = auth.uid()
            and (role = 'support' or role = 'admin')
        )
    );

create policy "Customers can delete their own messages"
    on ticket_messages for delete
    using (
        user_id = auth.uid()
    ); 