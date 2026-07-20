-- Create the storage bucket for product images if it doesn't exist
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;



-- Policy: Allow public to view images
create policy "Public Access"
on storage.objects for select
to public
using ( bucket_id = 'product-images' );

-- Policy: Allow authenticated users (admins) to upload images
create policy "Admin Upload Access"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'product-images' );

-- Policy: Allow authenticated users (admins) to update their own uploads (or anything, since we trust authenticated users for now based on the app's internal logic)
create policy "Admin Update Access"
on storage.objects for update
to authenticated
using ( bucket_id = 'product-images' );

-- Policy: Allow authenticated users (admins) to delete images
create policy "Admin Delete Access"
on storage.objects for delete
to authenticated
using ( bucket_id = 'product-images' );
