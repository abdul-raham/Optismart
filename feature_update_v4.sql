-- OPTISMART FEATURE UPDATE V4
-- Granular Super Admin Permission Toggles for Admin Users
-- Safe to run multiple times in the Supabase SQL Editor.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS can_manage_inventory BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS can_manage_users BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS can_manage_expenses BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS can_view_reports BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS can_delete_records BOOLEAN NOT NULL DEFAULT false;
