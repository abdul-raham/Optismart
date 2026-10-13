-- Fix 1: Break infinite recursion by making is_admin() use SECURITY DEFINER
-- so it bypasses users RLS when checking admin status
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

-- Fix 2 & 3: Allow unregistered DSA orders (dsa_id IS NULL) and let the
-- inserting user always see orders they created via created_by_auth_id
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS created_by_auth_id UUID;

-- Backfill existing orders (links dsa_id back to auth_id)
UPDATE public.orders o
SET created_by_auth_id = u.auth_id
FROM public.users u
WHERE o.dsa_id = u.id AND o.created_by_auth_id IS NULL;

-- Drop old policies
DROP POLICY IF EXISTS "orders_dsa_reseller_insert" ON public.orders;
DROP POLICY IF EXISTS "orders_role_select" ON public.orders;
DROP POLICY IF EXISTS "orders_admin_update" ON public.orders;

-- New INSERT: allow registered DSA, unregistered (dsa_id null), reseller, or admin
CREATE POLICY "orders_insert" ON public.orders
FOR INSERT WITH CHECK (
  public.is_admin()
  OR dsa_id = public.current_app_user_id()
  OR reseller_id = public.current_app_user_id()
  OR (dsa_id IS NULL AND auth.uid() IS NOT NULL)
);

-- New SELECT: also show orders created by this auth user (covers unregistered DSA orders)
CREATE POLICY "orders_select" ON public.orders
FOR SELECT USING (
  public.is_admin()
  OR dsa_id = public.current_app_user_id()
  OR reseller_id = public.current_app_user_id()
  OR created_by_auth_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.installer_jobs j
    WHERE j.order_id = orders.id AND j.installer_id = public.current_app_user_id()
  )
);

CREATE POLICY "orders_admin_update" ON public.orders
FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

NOTIFY pgrst, 'reload schema';
