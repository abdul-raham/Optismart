-- ==========================================
-- 1. Create missing utility functions for RLS
-- ==========================================
-- These functions are required by your existing RLS policies (e.g. leads_dsa_or_admin)
-- but were missing from your original database schema.

CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS UUID
LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claim.sub', true),
    ''
  )::UUID;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = public.current_app_user_id()
    AND role IN ('admin', 'super_admin')
  );
$$;

-- ==========================================
-- 2. Create installer_profiles table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.installer_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  location TEXT NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  rating DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  total_jobs INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for installer_profiles
ALTER TABLE public.installer_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "installer_profiles_read_active" ON public.installer_profiles;
CREATE POLICY "installer_profiles_read_active" ON public.installer_profiles
FOR SELECT USING (is_available = true OR user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "installer_profiles_owner_update" ON public.installer_profiles;
CREATE POLICY "installer_profiles_owner_update" ON public.installer_profiles
FOR UPDATE USING (user_id = auth.uid() OR public.is_admin())
WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "installer_profiles_insert" ON public.installer_profiles;
CREATE POLICY "installer_profiles_insert" ON public.installer_profiles
FOR INSERT WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- ==========================================
-- 3. Ensure products table has is_active
-- ==========================================
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_read_all" ON public.products;
CREATE POLICY "products_read_all" ON public.products
FOR SELECT USING (is_active = true OR public.is_admin());

-- ==========================================
-- 4. Change user to DSA role
-- ==========================================
UPDATE public.users 
SET role = 'dsa', status = 'active'
WHERE email ILIKE 'bakare0%@gmail.com';

UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{role}', '"dsa"')
WHERE email ILIKE 'bakare0%@gmail.com';
