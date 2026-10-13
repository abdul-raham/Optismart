-- Update user role from DSA to Admin for Adeosun Ezekiel (adeosunezekiel03@gmail.com)

-- 1. Update public.users table
UPDATE public.users 
SET role = 'admin'
WHERE id = 'c21cc250-0071-4bd7-895d-de954af8d540' OR email ILIKE 'adeosunezekiel03@gmail.com';

-- 2. Update auth.users metadata
UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{role}', '"admin"')
WHERE id = 'c21cc250-0071-4bd7-895d-de954af8d540' OR email ILIKE 'adeosunezekiel03@gmail.com';

-- 3. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
