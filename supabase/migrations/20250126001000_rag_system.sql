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