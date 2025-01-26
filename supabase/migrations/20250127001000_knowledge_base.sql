-- Create knowledge base table if it doesn't exist
create table if not exists public.knowledge_base (
    id uuid default gen_random_uuid() primary key,
    title text not null,
    content text not null,
    category text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    created_by uuid references auth.users(id),
    tags text[]
);

-- Enable RLS
alter table public.knowledge_base enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Knowledge base entries are viewable by all authenticated users" on public.knowledge_base;
drop policy if exists "Only support staff can insert knowledge base entries" on public.knowledge_base;
drop policy if exists "Only support staff can update knowledge base entries" on public.knowledge_base;

-- Create new policies
create policy "Knowledge base entries are viewable by all authenticated users"
    on public.knowledge_base for select
    to authenticated
    using (true);

create policy "Only support staff can insert knowledge base entries"
    on public.knowledge_base for insert
    to authenticated
    with check (
        exists (
            select 1 from profiles
            where id = auth.uid()
            and role in ('admin', 'support')
        )
    );

create policy "Only support staff can update knowledge base entries"
    on public.knowledge_base for update
    to authenticated
    using (
        exists (
            select 1 from profiles
            where id = auth.uid()
            and role in ('admin', 'support')
        )
    );

-- Create updated_at trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language plpgsql;

create trigger handle_updated_at
    before update on public.knowledge_base
    for each row
    execute procedure public.handle_updated_at();

-- Insert some sample knowledge base entries
insert into public.knowledge_base (title, content, category)
values 
    ('Getting Started', 'Welcome to our support system! Here are some basic tips to get started...', 'general'),
    ('Common Issues', 'Here are solutions to the most common issues users encounter...', 'troubleshooting'),
    ('Account Management', 'Learn how to manage your account settings, update profile, and more...', 'account')
on conflict do nothing; 