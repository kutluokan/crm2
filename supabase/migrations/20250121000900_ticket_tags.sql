-- Create tags table
create table tags (
  id uuid default uuid_generate_v4() primary key,
  name text not null unique,
  color text not null default '#808080',
  created_by uuid references profiles(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create junction table for ticket tags
create table ticket_tags (
  ticket_id uuid references tickets(id) on delete cascade not null,
  tag_id uuid references tags(id) on delete cascade not null,
  created_by uuid references profiles(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (ticket_id, tag_id)
);

-- Enable RLS
alter table tags enable row level security;
alter table ticket_tags enable row level security;

-- Policies for tags
create policy "Admin and support can create tags"
  on tags for insert
  with check (exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('admin', 'support')
  ));

create policy "Everyone can view tags"
  on tags for select
  using (true);

create policy "Admin and support can update tags"
  on tags for update
  using (exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('admin', 'support')
  ));

-- Policies for ticket tags
create policy "Admin and support can manage ticket tags"
  on ticket_tags for all
  using (exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('admin', 'support')
  ));

create policy "Everyone can view ticket tags"
  on ticket_tags for select
  using (true);

-- Add realtime for tags
alter publication supabase_realtime add table tags, ticket_tags;
alter table tags replica identity full;
alter table ticket_tags replica identity full; 