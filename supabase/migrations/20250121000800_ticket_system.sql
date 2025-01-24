-- Create tickets table
create table tickets (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text not null,
  status text not null default 'open',
  priority text not null default 'medium',
  customer_id uuid references profiles(id) not null,
  assigned_to uuid references profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create ticket_messages table for conversation history
create table ticket_messages (
  id uuid default uuid_generate_v4() primary key,
  ticket_id uuid references tickets(id) on delete cascade not null,
  user_id uuid references profiles(id) not null,
  message text not null,
  is_internal boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create response_templates table
create table response_templates (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  content text not null,
  category text not null,
  created_by uuid references profiles(id) not null,
  is_global boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create function to automatically assign tickets to support staff
create or replace function auto_assign_ticket()
returns trigger as $$
declare
  support_user_id uuid;
begin
  -- Get Sarah Support's ID by looking up her profile
  select id into support_user_id
  from profiles
  where role = 'support'
  and full_name = 'Sarah Support'
  limit 1;

  -- If Sarah Support is found, assign the ticket to her
  if support_user_id is not null then
    NEW.assigned_to = support_user_id;
  end if;

  return NEW;
end;
$$ language plpgsql;

-- Create trigger for auto-assignment
create trigger ticket_auto_assign
before insert on tickets
for each row
execute function auto_assign_ticket();

-- Enable RLS
alter table tickets enable row level security;
alter table ticket_messages enable row level security;

-- Create policies for tickets
create policy "Customers can view their own tickets"
  on tickets for select
  using (auth.uid() = customer_id);

create policy "Support can view assigned tickets"
  on tickets for select
  using (auth.uid() = assigned_to or 
        exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

create policy "Customers can create tickets"
  on tickets for insert
  with check (auth.uid() = customer_id);

create policy "Support and admin can update assigned tickets"
  on tickets for update
  using (auth.uid() = assigned_to or 
        exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

create policy "Customers can update their own tickets"
  on tickets for update
  using (auth.uid() = customer_id);

-- Create policies for ticket messages
create policy "Users can view messages of accessible tickets"
  on ticket_messages for select
  using (exists (
    select 1 from tickets t
    where t.id = ticket_id
    and (t.customer_id = auth.uid() 
         or t.assigned_to = auth.uid()
         or exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  ));

create policy "Users can create messages for accessible tickets"
  on ticket_messages for insert
  with check (exists (
    select 1 from tickets t
    where t.id = ticket_id
    and (t.customer_id = auth.uid() 
         or t.assigned_to = auth.uid()
         or exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  ));

-- Enable realtime for ticket messages
drop publication if exists supabase_realtime;
create publication supabase_realtime for table ticket_messages, tickets;
alter table ticket_messages replica identity full;
alter table tickets replica identity full; 