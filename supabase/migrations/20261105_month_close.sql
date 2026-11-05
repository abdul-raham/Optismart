-- OPTISMART: automatic month close (5 Nov 2026)
-- At 11:59 PM Lagos on the last day of each month, every order still not delivered (logged that month or earlier) is
-- cancelled ("not delivered by month end"), and the month is locked: its deliveries, dates and amounts can't change
-- except by a super admin, so the month's report stays final for payments. If a closed order is delivered later, an
-- admin restores it and marks it delivered; it counts in the month it's delivered (no re-uploading).
-- DSAs (and admins) are warned 3 days before each close. The first close, for October and earlier, is Sunday
-- 8 Nov 2026 at 11:59 PM, so the real deliveries among the old open orders can be marked first.
-- Safe to re-run.

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE TABLE IF NOT EXISTS public.month_closes (
  month DATE PRIMARY KEY,               -- first day of the month (Lagos)
  due_at TIMESTAMPTZ NOT NULL,          -- when it closes
  warned_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  cancelled_orders INTEGER
);
ALTER TABLE public.month_closes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "everyone signed in reads month closes" ON public.month_closes;
CREATE POLICY "everyone signed in reads month closes" ON public.month_closes FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public._month_start(m DATE) RETURNS TIMESTAMPTZ LANGUAGE sql IMMUTABLE AS $$
  SELECT (date_trunc('month', m)::timestamp) AT TIME ZONE 'Africa/Lagos' $$;
CREATE OR REPLACE FUNCTION public._month_end(m DATE) RETURNS TIMESTAMPTZ LANGUAGE sql IMMUTABLE AS $$
  SELECT ((date_trunc('month', m) + INTERVAL '1 month')::timestamp) AT TIME ZONE 'Africa/Lagos' $$;

-- First close: October and everything before it, on Sunday night. Then November at the end of the month.
INSERT INTO public.month_closes(month, due_at) VALUES ('2026-10-01', '2026-11-08 23:59:00+01') ON CONFLICT (month) DO NOTHING;
INSERT INTO public.month_closes(month, due_at) VALUES ('2026-11-01', public._month_end('2026-11-01') - INTERVAL '1 minute') ON CONFLICT (month) DO NOTHING;

/** Everything delivered before this moment is in a closed month. */
CREATE OR REPLACE FUNCTION public.closed_until() RETURNS TIMESTAMPTZ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(MAX(public._month_end(month)), '-infinity') FROM public.month_closes WHERE closed_at IS NOT NULL $$;

CREATE OR REPLACE FUNCTION public._is_super_admin() RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE (auth_id = auth.uid() OR id = auth.uid()) AND LOWER(role::text) = 'super_admin') $$;

-- The lock: a delivery in a closed month can't be undone, re-dated or have its amounts changed, and nothing can be
-- dated into a closed month. Super admins can still correct mistakes.
CREATE OR REPLACE FUNCTION public.guard_closed_month()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_until TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL OR public._is_super_admin() THEN RETURN NEW; END IF;
  v_until := public.closed_until();
  IF OLD.status IN ('delivered', 'completed') AND OLD.delivered_at < v_until
     AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.delivered_at IS DISTINCT FROM OLD.delivered_at
          OR NEW.quantity IS DISTINCT FROM OLD.quantity OR NEW.total_amount IS DISTINCT FROM OLD.total_amount OR NEW.dsa_id IS DISTINCT FROM OLD.dsa_id) THEN
    RAISE EXCEPTION 'Order % was delivered in % which is closed. Ask a super admin to change it.', OLD.order_number, to_char(OLD.delivered_at AT TIME ZONE 'Africa/Lagos', 'FMMonth YYYY');
  END IF;
  IF NEW.delivered_at IS DISTINCT FROM OLD.delivered_at AND NEW.delivered_at < v_until THEN
    RAISE EXCEPTION 'That delivery date is in a closed month. Use a date from % onwards.', to_char(v_until AT TIME ZONE 'Africa/Lagos', 'DD Mon YYYY');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_closed_month ON public.orders;
CREATE TRIGGER trg_guard_closed_month BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.guard_closed_month();

-- One summary per DSA at a close instead of one notification per cancelled order.
DO $$ BEGIN
  EXECUTE replace(pg_get_functiondef('public.trigger_order_notifications()'::regprocedure),
    $a$  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.dsa_id IS NOT NULL THEN$a$,
    $a$  IF current_setting('optismart.quiet_notifications', true) = 'on' THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.dsa_id IS NOT NULL THEN$a$);
END $$;

-- Runs every night at 11:59 PM Lagos: warns 3 days ahead, closes what's due, and books the next month.
CREATE OR REPLACE FUNCTION public.run_month_close()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; v_n INTEGER; v_dsas UUID[]; v_done JSONB := '[]'::jsonb; v_when TEXT;
        v_open TEXT[] := ARRAY['pending','paid','processing','rescheduled','approved','confirmed','dispatched'];
        v_this DATE := date_trunc('month', NOW() AT TIME ZONE 'Africa/Lagos')::date;
BEGIN
  INSERT INTO public.month_closes(month, due_at) VALUES (v_this, public._month_end(v_this) - INTERVAL '1 minute') ON CONFLICT (month) DO NOTHING;

  FOR r IN SELECT * FROM public.month_closes WHERE closed_at IS NULL AND warned_at IS NULL AND due_at <= NOW() + INTERVAL '3 days 12 hours' ORDER BY month LOOP
    v_when := to_char(r.due_at AT TIME ZONE 'Africa/Lagos', 'FMDay DD Mon') || ' at 11:59 PM';
    INSERT INTO public.notifications(user_id, title, message, type, link)
    SELECT o.dsa_id, 'Open orders close ' || v_when,
           COUNT(*) || ' of your orders are still not marked delivered. Ask an admin to mark the delivered ones (with the day they were delivered) before ' || v_when || '. The rest will be cancelled.',
           'order', '/app/dsa/orders'
      FROM public.orders o WHERE o.status::text = ANY(v_open) AND o.created_at < public._month_end(r.month) AND o.dsa_id IS NOT NULL
     GROUP BY o.dsa_id;
    INSERT INTO public.notifications(user_id, title, message, type, link)
    SELECT u.id, 'Month close ' || v_when,
           (SELECT COUNT(*) FROM public.orders o WHERE o.status::text = ANY(v_open) AND o.created_at < public._month_end(r.month)) ||
           ' orders are still open. Mark the delivered ones with their delivery date before ' || v_when || '; the rest will be cancelled and the month locked.',
           'order', '/app/admin/orders'
      FROM public.users u WHERE LOWER(u.role::text) IN ('admin', 'super_admin') AND u.status = 'active';
    UPDATE public.month_closes SET warned_at = NOW() WHERE month = r.month;
  END LOOP;

  FOR r IN SELECT * FROM public.month_closes WHERE closed_at IS NULL AND due_at <= NOW() ORDER BY month LOOP
    PERFORM set_config('optismart.quiet_notifications', 'on', true);
    WITH closed AS (
      UPDATE public.orders o
         SET status = 'cancelled', updated_at = NOW(),
             notes = CONCAT_WS(' ', o.notes, '[Closed at month end: not delivered by ' || to_char(r.due_at AT TIME ZONE 'Africa/Lagos', 'DD Mon YYYY') || '. If it was delivered, an admin can restore it and mark it delivered.]')
       WHERE o.status::text = ANY(v_open) AND o.created_at < public._month_end(r.month)
       RETURNING o.dsa_id
    ) SELECT COUNT(*)::int, COALESCE(array_agg(dsa_id) FILTER (WHERE dsa_id IS NOT NULL), '{}') INTO v_n, v_dsas FROM closed;
    INSERT INTO public.notifications(user_id, title, message, type, link)
    SELECT d, to_char(public._month_start(r.month) AT TIME ZONE 'Africa/Lagos', 'FMMonth') || ' is closed',
           COUNT(*) || ' of your orders that were never marked delivered were cancelled. If any was delivered, ask an admin to restore it and mark it delivered; it will count in the month it was delivered.',
           'order', '/app/dsa/orders'
      FROM unnest(v_dsas) d GROUP BY d;
    PERFORM set_config('optismart.quiet_notifications', 'off', true);
    UPDATE public.month_closes SET closed_at = NOW(), cancelled_orders = v_n WHERE month = r.month;
    -- Earlier months are covered by this close too.
    UPDATE public.month_closes SET closed_at = NOW(), cancelled_orders = COALESCE(cancelled_orders, 0) WHERE month < r.month AND closed_at IS NULL;
    v_done := v_done || jsonb_build_object('month', r.month, 'cancelled', v_n);
  END LOOP;
  RETURN jsonb_build_object('closed', v_done);
END; $$;
REVOKE ALL ON FUNCTION public.run_month_close() FROM PUBLIC, anon, authenticated;

-- What the Orders pages show: the next close, and how many open orders it will cancel (yours, or everyone's for admins).
CREATE OR REPLACE FUNCTION public.next_month_close()
RETURNS TABLE(month DATE, due_at TIMESTAMPTZ, open_orders INTEGER, closed_until TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me UUID := public._report_viewer();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  RETURN QUERY
  SELECT c.month, c.due_at,
         (SELECT COUNT(*)::int FROM public.orders o WHERE o.status::text IN ('pending','paid','processing','rescheduled','approved','confirmed','dispatched')
             AND o.created_at < public._month_end(c.month) AND (v_me IS NULL OR o.dsa_id = v_me)),
         public.closed_until()
    FROM public.month_closes c WHERE c.closed_at IS NULL ORDER BY c.due_at LIMIT 1;
END; $$;
GRANT EXECUTE ON FUNCTION public.next_month_close() TO authenticated;

-- Every night at 11:59 PM Lagos (22:59 UTC).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'month-close') THEN PERFORM cron.unschedule('month-close'); END IF;
  PERFORM cron.schedule('month-close', '59 22 * * *', $c$select public.run_month_close()$c$);
END $$;

NOTIFY pgrst, 'reload schema';
