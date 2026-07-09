-- Fix Admin Role
-- It appears your user was accidentally downgraded to a DSA in the database
-- during a previous database migration script (fix_issues.sql).
-- This script sets you back to super_admin so you can bypass the RLS policies!

UPDATE public.users 
SET role = 'super_admin'
WHERE email ILIKE '%bakare001@gmail.com%';

UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{role}', '"super_admin"')
WHERE email ILIKE '%bakare001@gmail.com%';

NOTIFY pgrst, 'reload schema';
