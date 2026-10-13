-- ULTIMATE RLS FIX
-- We discovered that the database schema uses a separate `id` (uuid_generate_v4) and `auth_id` (auth.uid).
-- Previous scripts tried to compare `dsa_id`, `user_id`, or `installer_id` (which store `id`) directly to `auth.uid()`, which ALWAYS fails!

-- 1. Restore the proper current_app_user_id() that maps auth.uid() to public.users.id
-- We use SECURITY DEFINER to bypass RLS and prevent infinite loops.
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

-- 2. Restore is_admin() properly mapping auth.uid()
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

-- 3. Ensure reseller_id column exists
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS reseller_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_reseller ON public.orders(reseller_id);

-- 4. Fix Orders RLS (using current_app_user_id which matches dsa_id exactly)
DROP POLICY IF EXISTS "orders_dsa_reseller_insert" ON public.orders;
CREATE POLICY "orders_dsa_reseller_insert" ON public.orders
FOR INSERT WITH CHECK (
  public.is_admin()
  OR dsa_id = public.current_app_user_id()
  OR reseller_id = public.current_app_user_id()
);

DROP POLICY IF EXISTS "orders_role_select" ON public.orders;
CREATE POLICY "orders_role_select" ON public.orders
FOR SELECT USING (
  public.is_admin()
  OR dsa_id = public.current_app_user_id()
  OR reseller_id = public.current_app_user_id()
  OR EXISTS (
    SELECT 1 FROM public.installer_jobs j
    WHERE j.order_id = orders.id AND j.installer_id = public.current_app_user_id()
  )
);

DROP POLICY IF EXISTS "orders_admin_update" ON public.orders;
CREATE POLICY "orders_admin_update" ON public.orders
FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 5. Fix Leads RLS
DROP POLICY IF EXISTS "leads_dsa_or_admin" ON public.leads;
CREATE POLICY "leads_dsa_or_admin" ON public.leads
FOR ALL USING (dsa_id = public.current_app_user_id() OR public.is_admin())
WITH CHECK (dsa_id = public.current_app_user_id() OR public.is_admin());

-- 6. Fix Users RLS to also correctly map
DROP POLICY IF EXISTS "users_select_own_or_admin" ON public.users;
CREATE POLICY "users_select_own_or_admin" ON public.users
FOR SELECT USING (auth_id = auth.uid() OR public.is_admin());

-- 7. Fix Installer Jobs RLS
DROP POLICY IF EXISTS "installer_jobs_dsa_insert" ON public.installer_jobs;
CREATE POLICY "installer_jobs_dsa_insert" ON public.installer_jobs
FOR INSERT WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id AND o.dsa_id = public.current_app_user_id()
  )
);

DROP POLICY IF EXISTS "installer_jobs_role_access" ON public.installer_jobs;
CREATE POLICY "installer_jobs_role_access" ON public.installer_jobs
FOR SELECT USING (
  public.is_admin()
  OR installer_id = public.current_app_user_id()
  OR EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = installer_jobs.order_id AND o.dsa_id = public.current_app_user_id()
  )
);

DROP POLICY IF EXISTS "installer_jobs_installer_update" ON public.installer_jobs;
CREATE POLICY "installer_jobs_installer_update" ON public.installer_jobs
FOR UPDATE USING (installer_id = public.current_app_user_id() OR public.is_admin())
WITH CHECK (installer_id = public.current_app_user_id() OR public.is_admin());

-- 8. Fix Installer Profiles RLS
DROP POLICY IF EXISTS "installer_profiles_manage_own" ON public.installer_profiles;
CREATE POLICY "installer_profiles_manage_own" ON public.installer_profiles
FOR ALL USING (user_id = public.current_app_user_id() OR public.is_admin())
WITH CHECK (user_id = public.current_app_user_id() OR public.is_admin());

DROP POLICY IF EXISTS "installer_profiles_read_active" ON public.installer_profiles;
CREATE POLICY "installer_profiles_read_active" ON public.installer_profiles
FOR SELECT USING (is_available = true OR user_id = public.current_app_user_id() OR public.is_admin());

-- 9. Fix Push Subscriptions RLS
DROP POLICY IF EXISTS "Users can insert their own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can insert their own subscriptions" ON public.push_subscriptions
FOR INSERT WITH CHECK (public.current_app_user_id() = user_id);

DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can view their own subscriptions" ON public.push_subscriptions
FOR SELECT USING (public.current_app_user_id() = user_id);

DROP POLICY IF EXISTS "Users can update their own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can update their own subscriptions" ON public.push_subscriptions
FOR UPDATE USING (public.current_app_user_id() = user_id);

DROP POLICY IF EXISTS "Users can delete their own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can delete their own subscriptions" ON public.push_subscriptions
FOR DELETE USING (public.current_app_user_id() = user_id);

NOTIFY pgrst, 'reload schema';
