-- ============================================================
-- FIX: Admin product editing + pending order edits
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Ensure is_admin() correctly maps auth.uid() → auth_id column
--    (this is the root cause of admin being blocked from editing products)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_adm BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  ) INTO is_adm;
  RETURN is_adm;
END;
$$;

-- 2. Ensure current_app_user_id() also correctly maps via auth_id
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app_id UUID;
BEGIN
  SELECT id INTO app_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
  RETURN app_id;
END;
$$;

-- 3. Drop ALL existing product policies (to clear any duplicates / conflicts)
DROP POLICY IF EXISTS "products_public_read"    ON public.products;
DROP POLICY IF EXISTS "products_admin_manage"   ON public.products;
DROP POLICY IF EXISTS "products_read_all"       ON public.products;

-- 4. Re-create clean product policies
-- Anyone logged in (or anonymous) can read active products; admins see all
CREATE POLICY "products_select" ON public.products
FOR SELECT USING (is_active = true OR public.is_admin());

-- Only admins can INSERT, UPDATE, DELETE products
CREATE POLICY "products_admin_write" ON public.products
FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "products_admin_update" ON public.products
FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "products_admin_delete" ON public.products
FOR DELETE USING (public.is_admin());

-- 5. Fix orders UPDATE policy so admins can edit pending (and all) orders
DROP POLICY IF EXISTS "orders_admin_update" ON public.orders;
CREATE POLICY "orders_admin_update" ON public.orders
FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Also allow DSA to update their own pending orders (optional, remove if not wanted)
DROP POLICY IF EXISTS "orders_dsa_update_pending" ON public.orders;
CREATE POLICY "orders_dsa_update_pending" ON public.orders
FOR UPDATE USING (
  dsa_id = public.current_app_user_id() AND status = 'pending'
) WITH CHECK (
  dsa_id = public.current_app_user_id() AND status = 'pending'
);

NOTIFY pgrst, 'reload schema';
