-- Security fix (2 Nov 2026).
-- 1. Self sign-up could request 'admin' or 'super_admin' and get it. Now sign-up only creates dsa, installer or
--    reseller accounts; admin roles are given by an admin afterwards.
-- 2. "Users can update their own row" had no column limits, so anyone could raise their own role or permissions.
--    Now only admins can change role, status, permissions, probation and targets; only super admins can grant or
--    change admin and super admin accounts. The service role (server tools) is not restricted.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE requested_role user_role;
BEGIN
  IF NEW.raw_user_meta_data ->> 'role' IN ('dsa', 'installer', 'reseller') THEN
    requested_role := (NEW.raw_user_meta_data ->> 'role')::user_role;
  ELSE
    requested_role := 'dsa'::user_role;
  END IF;
  INSERT INTO public.users (auth_id, full_name, email, phone, role, status)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)), NEW.email,
          NEW.raw_user_meta_data ->> 'phone', requested_role, 'active')
  ON CONFLICT (auth_id) DO NOTHING;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.guard_user_privileges() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE caller public.users;
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO caller FROM public.users WHERE auth_id = auth.uid();
  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.can_manage_inventory IS DISTINCT FROM OLD.can_manage_inventory OR NEW.can_manage_users IS DISTINCT FROM OLD.can_manage_users
     OR NEW.can_manage_expenses IS DISTINCT FROM OLD.can_manage_expenses OR NEW.can_view_reports IS DISTINCT FROM OLD.can_view_reports
     OR NEW.can_delete_records IS DISTINCT FROM OLD.can_delete_records
     OR NEW.probation_status IS DISTINCT FROM OLD.probation_status OR NEW.probation_approval_status IS DISTINCT FROM OLD.probation_approval_status
     OR NEW.commission_threshold IS DISTINCT FROM OLD.commission_threshold OR NEW.commission_per_camera IS DISTINCT FROM OLD.commission_per_camera
     OR NEW.expected_orders_target IS DISTINCT FROM OLD.expected_orders_target OR NEW.expected_leads_target IS DISTINCT FROM OLD.expected_leads_target
     OR NEW.auth_id IS DISTINCT FROM OLD.auth_id OR NEW.email IS DISTINCT FROM OLD.email THEN
    IF caller.role IS NULL OR caller.role NOT IN ('admin', 'super_admin') THEN
      RAISE EXCEPTION 'Only an administrator can change roles, status or permissions';
    END IF;
    IF caller.role <> 'super_admin' AND (NEW.role IN ('admin', 'super_admin') OR OLD.role IN ('admin', 'super_admin')
       OR NEW.can_manage_users IS DISTINCT FROM OLD.can_manage_users) THEN
      RAISE EXCEPTION 'Only a super admin can manage administrator accounts';
    END IF;
    IF NEW.auth_id = auth.uid() AND NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'You cannot change your own role';
    END IF;
  END IF;
  RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS guard_user_privileges ON public.users;
CREATE TRIGGER guard_user_privileges BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.guard_user_privileges();
