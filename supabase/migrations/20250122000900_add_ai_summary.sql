-- Add ai_summary column to tickets table
alter table tickets add column ai_summary text;

-- Add comment to describe the column
comment on column tickets.ai_summary is 'AI-generated summary of the ticket conversation'; 