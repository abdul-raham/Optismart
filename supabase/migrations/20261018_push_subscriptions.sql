-- OPTISMART: phone push notifications that actually register (15 Oct 2026)
-- Nobody was subscribed: the app asked for permission but never saved the phone's push address,
-- and saving needed a unique endpoint that did not exist. Run once in the Supabase SQL Editor. Safe to re-run.

BEGIN;

-- One row per phone/browser.
DELETE FROM public.push_subscriptions a USING public.push_subscriptions b
 WHERE a.endpoint = b.endpoint AND a.created_at < b.created_at;
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_key ON public.push_subscriptions(endpoint);
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS device TEXT;

-- Save (or move to the signed-in person) this phone's push address.
CREATE OR REPLACE FUNCTION public.save_push_subscription(p_endpoint TEXT, p_p256dh TEXT, p_auth TEXT, p_device TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me UUID := public.current_portal_user_id();
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  INSERT INTO public.push_subscriptions(user_id, endpoint, p256dh, auth, device, last_seen_at)
  VALUES (v_me, p_endpoint, p_p256dh, p_auth, LEFT(p_device, 120), NOW())
  ON CONFLICT (endpoint) DO UPDATE SET user_id = v_me, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
                                        device = EXCLUDED.device, last_seen_at = NOW();
END; $$;

CREATE OR REPLACE FUNCTION public.remove_push_subscription(p_endpoint TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.push_subscriptions WHERE endpoint = p_endpoint AND user_id = public.current_portal_user_id();
$$;

-- Admin: who has phone notifications on.
CREATE OR REPLACE FUNCTION public.push_notification_status()
RETURNS TABLE(user_id UUID, full_name TEXT, email TEXT, role TEXT, devices INTEGER, last_seen_at TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  RETURN QUERY
  SELECT u.id, u.full_name::text, u.email::text, u.role::text, COUNT(s.id)::int, MAX(s.last_seen_at)
    FROM public.users u LEFT JOIN public.push_subscriptions s ON s.user_id = u.id
   WHERE COALESCE(u.status::text, 'active') = 'active'
   GROUP BY u.id ORDER BY COUNT(s.id) = 0 DESC, u.role::text, u.full_name;
END; $$;

GRANT EXECUTE ON FUNCTION public.save_push_subscription(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_push_subscription(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.push_notification_status() TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
