-- Add delete policies for tickets
create policy "Support and admin can delete tickets"
    on tickets for delete
    using (
        exists (
            select 1 from profiles
            where id = auth.uid()
            and (role = 'support' or role = 'admin')
        )
    ); 