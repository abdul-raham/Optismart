-- PROMOTE USER TO SUPER ADMIN
-- Explicitly promotes user ID a25750c3-3168-4ef8-82ed-f70b259fd759 and Bakare / Adeosun emails to super_admin.

UPDATE public.users 
SET role = 'super_admin'
WHERE id = 'a25750c3-3168-4ef8-82ed-f70b259fd759'
   OR email ILIKE '%bakare001@gmail.com%' 
   OR email ILIKE '%adeosunezekiel%';

UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{role}', '"super_admin"')
WHERE id = 'a25750c3-3168-4ef8-82ed-f70b259fd759'
   OR email ILIKE '%bakare001@gmail.com%' 
   OR email ILIKE '%adeosunezekiel%';

NOTIFY pgrst, 'reload schema';
