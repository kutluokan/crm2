-- Create ticket_messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;

-- Allow admins and support to see all messages
CREATE POLICY "Admins and support can see all messages"
ON ticket_messages
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND (profiles.role = 'admin' OR profiles.role = 'support')
    )
);

-- Allow customers to see messages for their own tickets
CREATE POLICY "Customers can see messages for their tickets"
ON ticket_messages
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM tickets
        WHERE tickets.id = ticket_messages.ticket_id
        AND tickets.customer_id = auth.uid()
    )
);

-- Allow admins and support to insert messages
CREATE POLICY "Admins and support can insert messages"
ON ticket_messages
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND (profiles.role = 'admin' OR profiles.role = 'support')
    )
);

-- Allow customers to insert messages on their own tickets
CREATE POLICY "Customers can insert messages on their tickets"
ON ticket_messages
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM tickets
        WHERE tickets.id = ticket_messages.ticket_id
        AND tickets.customer_id = auth.uid()
    )
);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_ticket_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ticket_messages_updated_at
    BEFORE UPDATE ON ticket_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_ticket_messages_updated_at();

-- Add is_system column to ticket_messages
ALTER TABLE ticket_messages
ADD COLUMN is_system BOOLEAN DEFAULT FALSE;

-- Update existing messages
UPDATE ticket_messages
SET is_system = FALSE
WHERE is_system IS NULL; 