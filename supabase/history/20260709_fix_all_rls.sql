-- Comprehensive Fix for Infinite Recursion & RLS Violations

-- 1. Helper function that safely bypasses RLS without losing auth.uid() context
-- By passing the user_id as a parameter, we avoid the auth.uid() null issue in SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.check_user_is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = user_id
    AND role IN ('admin', 'super_admin')
  );
$$;

-- 2. Main is_admin() function that policies use
-- This runs in the caller's context so auth.uid() works, then passes it to the secure helper
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT public.check_user_is_admin(auth.uid());
$$;

-- 3. Ensure reseller_id column exists
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS reseller_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_reseller ON public.orders(reseller_id);

-- 4. Fix Orders RLS
DROP POLICY IF EXISTS "orders_dsa_reseller_insert" ON public.orders;
CREATE POLICY "orders_dsa_reseller_insert" ON public.orders
FOR INSERT WITH CHECK (
  public.is_admin()
  OR dsa_id = auth.uid()
  OR reseller_id = auth.uid()
);

DROP POLICY IF EXISTS "orders_role_select" ON public.orders;
CREATE POLICY "orders_role_select" ON public.orders
FOR SELECT USING (
  public.is_admin()
  OR dsa_id = auth.uid()
  OR reseller_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.installer_jobs j
    WHERE j.order_id = orders.id AND j.installer_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "orders_admin_update" ON public.orders;
CREATE POLICY "orders_admin_update" ON public.orders
FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 5. Fix Leads RLS
DROP POLICY IF EXISTS "leads_dsa_or_admin" ON public.leads;
CREATE POLICY "leads_dsa_or_admin" ON public.leads
FOR ALL USING (dsa_id = auth.uid() OR public.is_admin())
WITH CHECK (dsa_id = auth.uid() OR public.is_admin());

NOTIFY pgrst, 'reload schema';
