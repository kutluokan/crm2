-- Add source column to tickets table
alter table tickets 
add column if not exists source text default 'manual';

-- Add comment to describe the column
comment on column tickets.source is 'Source of the ticket creation (manual, ai_assistant, etc.)';

-- Update existing tickets to have 'manual' as source
update tickets 
set source = 'manual' 
where source is null; 