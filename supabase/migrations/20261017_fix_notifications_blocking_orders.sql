-- OPTISMART: URGENT — orders could not be created or change status since 13 Oct (15 Oct 2026)
-- notify_user() cast the type to "notification_type", which does not exist in this database
-- (notifications.type is plain text). Every order insert / status change creates a notification,
-- so the error rolled back the whole order. Run once in the Supabase SQL Editor. Safe to re-run.

BEGIN;

-- A notification problem must never stop an order from saving again: failures become warnings.
CREATE OR REPLACE FUNCTION public.notify_user(p_user UUID, p_title TEXT, p_message TEXT, p_type TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role TEXT;
BEGIN
  IF p_user IS NULL THEN RETURN; END IF;
  SELECT LOWER(role::text) INTO v_role FROM public.users WHERE id = p_user;
  INSERT INTO public.notifications(user_id, title, message, type, link)
  VALUES (p_user, LEFT(p_title, 200), LEFT(p_message, 1000), COALESCE(p_type, 'system'),
          CASE WHEN p_type = 'job' THEN '/app/installer/jobs'
               WHEN p_type = 'commission' AND v_role = 'installer' THEN '/app/installer/earnings'
               WHEN p_type = 'commission' THEN '/app/dsa/commission'
               WHEN v_role IN ('admin', 'super_admin') THEN '/app/admin/orders'
               ELSE '/app/dsa/orders' END);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_user failed for %: %', p_user, SQLERRM;
END; $$;

CREATE OR REPLACE FUNCTION public.send_portal_notification(p_user UUID, p_title TEXT, p_message TEXT,
                                                           p_link TEXT DEFAULT '/app', p_type TEXT DEFAULT 'system')
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.current_portal_user_id() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  INSERT INTO public.notifications(user_id, title, message, type, link)
  VALUES (p_user, LEFT(p_title, 200), LEFT(p_message, 1000),
          CASE WHEN p_type IN ('order', 'job', 'payment', 'system', 'training', 'commission') THEN p_type ELSE 'system' END,
          LEFT(COALESCE(p_link, '/app'), 300));
END; $$;
GRANT EXECUTE ON FUNCTION public.send_portal_notification(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';

-- Check (should return no error): SELECT public.notify_user(NULL, 'x', 'x', 'order');
