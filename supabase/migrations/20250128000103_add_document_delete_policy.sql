-- Add delete policies for documents
create policy "Support and admin can delete documents"
    on documents for delete
    using (
        exists (
            select 1 from profiles
            where id = auth.uid()
            and (role = 'support' or role = 'admin')
        )
    ); 