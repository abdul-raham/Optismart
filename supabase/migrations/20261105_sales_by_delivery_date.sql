-- OPTISMART: count each sale in the month it was DELIVERED, not the month it was logged (5 Nov 2026)
-- Reconciling October: the report counted orders logged in October that are delivered now, so an order logged in
-- September and delivered in October, or a late upload for an October delivery, landed in the wrong month (or none).
-- Now: every delivery has a date (the admin can say which day it happened), every status change is recorded, and
-- the reports count sales by delivery date in Lagos months, worked out in the database (no 1,000-row limit).
-- Additive and safe to re-run.

-- 1. Delivery dates for the 202 deliveries recorded before dates were kept (Jun–Aug), marked as estimates.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivered_at_estimated BOOLEAN NOT NULL DEFAULT false;
UPDATE public.orders
   SET delivered_at = CASE WHEN updated_at < '2026-09-05' THEN updated_at
                           ELSE COALESCE(expected_delivery_date::timestamp AT TIME ZONE 'Africa/Lagos' + INTERVAL '12 hours', created_at) END,
       delivered_at_estimated = true
 WHERE status IN ('delivered', 'completed') AND delivered_at IS NULL;

-- 2. Every status change, with who and when.
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  delivered_at TIMESTAMPTZ,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS order_status_history_order ON public.order_status_history(order_id, changed_at);
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins read order history" ON public.order_status_history;
CREATE POLICY "admins read order history" ON public.order_status_history FOR SELECT TO authenticated
  USING ((SELECT public.is_admin_user(auth.uid())) OR EXISTS (
    SELECT 1 FROM public.orders o JOIN public.users u ON u.id = o.dsa_id
     WHERE o.id = order_status_history.order_id AND (u.auth_id = (SELECT auth.uid()) OR u.id = (SELECT auth.uid()))));

CREATE OR REPLACE FUNCTION public.record_order_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status OR NEW.delivered_at IS DISTINCT FROM OLD.delivered_at THEN
    INSERT INTO public.order_status_history(order_id, from_status, to_status, delivered_at, changed_by)
    VALUES (NEW.id, CASE WHEN TG_OP = 'UPDATE' THEN OLD.status::text END, NEW.status::text, NEW.delivered_at, auth.uid());
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_record_order_status ON public.orders;
CREATE TRIGGER trg_record_order_status AFTER INSERT OR UPDATE OF status, delivered_at ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.record_order_status();

-- 3. "Delivered on": the admin marking an order delivered can give the day it actually happened (today by default,
-- never in the future, at most 60 days back), e.g. an October delivery uploaded in November counts in October.
CREATE OR REPLACE FUNCTION public._delivery_time(p_day DATE)
RETURNS TIMESTAMPTZ LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE v_today DATE := (NOW() AT TIME ZONE 'Africa/Lagos')::date;
BEGIN
  IF p_day IS NULL OR p_day = v_today THEN RETURN NOW(); END IF;
  IF p_day > v_today THEN RAISE EXCEPTION 'The delivery date can''t be in the future'; END IF;
  IF p_day < v_today - 60 THEN RAISE EXCEPTION 'The delivery date can''t be more than 60 days ago'; END IF;
  RETURN (p_day::timestamp + INTERVAL '12 hours') AT TIME ZONE 'Africa/Lagos';
END; $$;

DROP FUNCTION IF EXISTS public._deliver_order(public.orders, UUID, BOOLEAN, TEXT);
CREATE OR REPLACE FUNCTION public._deliver_order(p_order public.orders, p_location_id UUID, p_untracked BOOLEAN, p_note TEXT, p_delivered_on DATE DEFAULT NULL)
RETURNS public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_out public.orders; v_at TIMESTAMPTZ := public._delivery_time(p_delivered_on);
BEGIN
  PERFORM set_config('optismart.stock_flow', 'on', true);
  IF NOT p_untracked THEN
    IF p_order.product_id IS NULL THEN RAISE EXCEPTION 'Order % has no product', p_order.order_number; END IF;
    PERFORM public._take_stock(p_order.product_id, p_location_id, GREATEST(COALESCE(p_order.quantity, 1), 1), p_order, 'cameras');
    IF p_order.accessory_product_id IS NOT NULL AND p_order.accessory_quantity > 0 THEN
      PERFORM public._take_stock(p_order.accessory_product_id, p_location_id, p_order.accessory_quantity, p_order, 'SD cards');
    END IF;
  END IF;
  UPDATE public.orders SET status = 'delivered', delivered_at = v_at, delivered_at_estimated = false, updated_at = NOW(),
         fulfillment_location_id = CASE WHEN p_untracked THEN fulfillment_location_id ELSE p_location_id END,
         stock_untracked = p_untracked,
         notes = CONCAT_WS(' ', notes,
           CASE WHEN p_untracked THEN '[Delivered without stock deduction: ' || COALESCE(p_note, 'no reason given') || ']' END,
           CASE WHEN p_delivered_on IS NOT NULL AND v_at < NOW() - INTERVAL '1 day' THEN '[Delivered on ' || to_char(p_delivered_on, 'DD Mon YYYY') || ', recorded ' || to_char(NOW() AT TIME ZONE 'Africa/Lagos', 'DD Mon YYYY') || ']' END)
   WHERE id = p_order.id RETURNING * INTO v_out;
  -- The commission belongs to the month of the delivery too.
  UPDATE public.commissions SET triggered_at = v_at WHERE order_id = p_order.id AND status <> 'paid';
  PERFORM set_config('optismart.stock_flow', 'off', true);
  RETURN v_out;
END; $$;

DROP FUNCTION IF EXISTS public.fulfill_order(UUID, UUID, BOOLEAN, TEXT);
CREATE OR REPLACE FUNCTION public.fulfill_order(p_order_id UUID, p_location_id UUID DEFAULT NULL, p_untracked BOOLEAN DEFAULT false, p_reason TEXT DEFAULT NULL, p_delivered_on DATE DEFAULT NULL)
RETURNS public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order public.orders; v_loc UUID;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.status IN ('delivered', 'completed') THEN RAISE EXCEPTION 'Order % is already delivered', v_order.order_number; END IF;
  IF v_order.status = 'cancelled' THEN RAISE EXCEPTION 'Order % is cancelled', v_order.order_number; END IF;
  IF p_untracked THEN
    IF BTRIM(COALESCE(p_reason, '')) = '' THEN RAISE EXCEPTION 'Give a reason for delivering without stock deduction'; END IF;
    RETURN public._deliver_order(v_order, NULL, true, p_reason, p_delivered_on);
  END IF;
  v_loc := COALESCE(p_location_id, v_order.fulfillment_location_id);
  IF v_loc IS NULL THEN RAISE EXCEPTION 'Choose the branch this order ships from'; END IF;
  RETURN public._deliver_order(v_order, v_loc, false, NULL, p_delivered_on);
END; $$;

DROP FUNCTION IF EXISTS public.restore_cancelled_order(UUID, TEXT, UUID, BOOLEAN, TEXT);
CREATE OR REPLACE FUNCTION public.restore_cancelled_order(p_order_id UUID, p_new_status TEXT, p_location_id UUID DEFAULT NULL, p_untracked BOOLEAN DEFAULT false, p_reason TEXT DEFAULT NULL, p_delivered_on DATE DEFAULT NULL)
RETURNS public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order public.orders; v_out public.orders; v_location UUID; v_reason TEXT := NULLIF(BTRIM(COALESCE(p_reason, '')), '');
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_new_status NOT IN ('pending', 'delivered') THEN RAISE EXCEPTION 'A cancelled order can only be restored to pending or delivered'; END IF;
  IF v_reason IS NULL THEN RAISE EXCEPTION 'Give a reason for restoring this cancelled order'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.status <> 'cancelled' THEN RAISE EXCEPTION 'Order % is %, not cancelled', v_order.order_number, v_order.status; END IF;
  UPDATE public.orders SET notes=CONCAT_WS(' ', notes, '[Restored by admin: ' || v_reason || ']'), updated_at=NOW() WHERE id=v_order.id RETURNING * INTO v_order;
  IF p_new_status = 'pending' THEN
    UPDATE public.orders SET status='pending', delivered_at=NULL, delivered_at_estimated=false, stock_untracked=false, updated_at=NOW() WHERE id=v_order.id RETURNING * INTO v_out;
    RETURN v_out;
  END IF;
  IF p_untracked THEN RETURN public._deliver_order(v_order, NULL, true, v_reason, p_delivered_on); END IF;
  v_location := COALESCE(p_location_id, v_order.fulfillment_location_id);
  IF v_location IS NULL THEN RAISE EXCEPTION 'Choose the branch this order ships from'; END IF;
  RETURN public._deliver_order(v_order, v_location, false, 'Restored delivery: ' || v_reason, p_delivered_on);
END; $$;

-- Correct the delivery date of an order already marked delivered (e.g. marked late). Admins only, with a reason.
CREATE OR REPLACE FUNCTION public.set_delivery_date(p_order_id UUID, p_delivered_on DATE, p_reason TEXT)
RETURNS public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order public.orders; v_at TIMESTAMPTZ; v_reason TEXT := NULLIF(BTRIM(COALESCE(p_reason, '')), '');
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF v_reason IS NULL THEN RAISE EXCEPTION 'Give a reason for changing the delivery date'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.status NOT IN ('delivered', 'completed') THEN RAISE EXCEPTION 'Order % isn''t delivered yet', v_order.order_number; END IF;
  v_at := public._delivery_time(p_delivered_on);
  UPDATE public.orders SET delivered_at = v_at, delivered_at_estimated = false, updated_at = NOW(),
         notes = CONCAT_WS(' ', notes, '[Delivery date set to ' || to_char(p_delivered_on, 'DD Mon YYYY') || ': ' || v_reason || ']')
   WHERE id = p_order_id RETURNING * INTO v_order;
  UPDATE public.commissions SET triggered_at = v_at WHERE order_id = p_order_id AND status <> 'paid';
  RETURN v_order;
END; $$;
REVOKE ALL ON FUNCTION public.set_delivery_date(UUID, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_delivery_date(UUID, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_order(UUID, UUID, BOOLEAN, TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_cancelled_order(UUID, TEXT, UUID, BOOLEAN, TEXT, DATE) TO authenticated;
REVOKE ALL ON FUNCTION public._deliver_order(public.orders, UUID, BOOLEAN, TEXT, DATE) FROM PUBLIC, anon, authenticated;

-- 4. Report figures, worked out in the database. Sold = delivered within the period (by delivery date);
-- logged = created within the period; open = not delivered or cancelled yet (whenever logged), and how many of those
-- are older than 14 days (likely delivered but never marked). Admins see everyone; a DSA only themselves.
CREATE OR REPLACE FUNCTION public._report_viewer()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN public.is_admin_user(auth.uid()) THEN NULL
              ELSE (SELECT id FROM public.users WHERE auth_id = auth.uid() OR id = auth.uid() LIMIT 1) END
$$;

CREATE OR REPLACE FUNCTION public.sales_report(p_start TIMESTAMPTZ DEFAULT NULL, p_end TIMESTAMPTZ DEFAULT NULL, p_dsa UUID DEFAULT NULL)
RETURNS TABLE(dsa_id UUID, dsa_name TEXT, dsa_email TEXT, orders_logged INTEGER, delivered_orders INTEGER, cameras_sold INTEGER,
              revenue NUMERIC, open_orders INTEGER, open_cameras INTEGER, stale_open INTEGER, cancelled_orders INTEGER,
              commission NUMERIC, commission_paid NUMERIC)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me UUID := public._report_viewer(); v_dsa UUID; s TIMESTAMPTZ := COALESCE(p_start, '-infinity'); e TIMESTAMPTZ := COALESCE(p_end, 'infinity');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  v_dsa := CASE WHEN v_me IS NULL THEN p_dsa ELSE v_me END;
  RETURN QUERY
  WITH o AS (SELECT * FROM public.orders x WHERE v_dsa IS NULL OR x.dsa_id = v_dsa),
  per AS (
    SELECT o.dsa_id AS id,
      COUNT(*) FILTER (WHERE o.created_at >= s AND o.created_at < e)::int AS logged,
      COUNT(*) FILTER (WHERE o.status IN ('delivered','completed') AND o.delivered_at >= s AND o.delivered_at < e)::int AS delivered,
      COALESCE(SUM(o.quantity) FILTER (WHERE o.status IN ('delivered','completed') AND o.delivered_at >= s AND o.delivered_at < e), 0)::int AS cams,
      COALESCE(SUM(o.total_amount) FILTER (WHERE o.status IN ('delivered','completed') AND o.delivered_at >= s AND o.delivered_at < e), 0) AS rev,
      COUNT(*) FILTER (WHERE o.status NOT IN ('delivered','completed','cancelled') AND o.created_at < e)::int AS open_n,
      COALESCE(SUM(o.quantity) FILTER (WHERE o.status NOT IN ('delivered','completed','cancelled') AND o.created_at < e), 0)::int AS open_c,
      COUNT(*) FILTER (WHERE o.status NOT IN ('delivered','completed','cancelled') AND o.created_at < LEAST(e, NOW()) - INTERVAL '14 days')::int AS stale,
      COUNT(*) FILTER (WHERE o.status = 'cancelled' AND o.created_at >= s AND o.created_at < e)::int AS cancelled
    FROM o GROUP BY o.dsa_id
  ),
  comm AS (
    SELECT c.dsa_id AS id, SUM(c.amount) AS total, SUM(c.amount) FILTER (WHERE c.status = 'paid') AS paid
      FROM public.commissions c WHERE (v_dsa IS NULL OR c.dsa_id = v_dsa) AND c.triggered_at >= s AND c.triggered_at < e GROUP BY c.dsa_id
  )
  SELECT per.id, COALESCE(u.full_name, 'Unregistered'), COALESCE(u.email, '—'), per.logged, per.delivered, per.cams, per.rev,
         per.open_n, per.open_c, per.stale, per.cancelled, COALESCE(comm.total, 0), COALESCE(comm.paid, 0)
    FROM per LEFT JOIN public.users u ON u.id = per.id LEFT JOIN comm ON comm.id IS NOT DISTINCT FROM per.id
   WHERE per.logged > 0 OR per.delivered > 0 OR per.open_n > 0 OR COALESCE(comm.total, 0) > 0
   ORDER BY per.cams DESC, per.delivered DESC, 2;
END; $$;

-- Month by month (Lagos months): sales by delivery month, orders by the month they were logged.
CREATE OR REPLACE FUNCTION public.sales_by_month(p_dsa UUID DEFAULT NULL, p_months INTEGER DEFAULT 12)
RETURNS TABLE(month TEXT, cameras INTEGER, delivered_orders INTEGER, revenue NUMERIC, orders_logged INTEGER, commissions NUMERIC, active_dsas INTEGER, top_dsa TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me UUID := public._report_viewer(); v_dsa UUID; v_from TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  v_dsa := CASE WHEN v_me IS NULL THEN p_dsa ELSE v_me END;
  v_from := CASE WHEN p_months IS NULL OR p_months <= 0 THEN '-infinity'
                 ELSE (date_trunc('month', NOW() AT TIME ZONE 'Africa/Lagos') - make_interval(months => p_months - 1)) AT TIME ZONE 'Africa/Lagos' END;
  RETURN QUERY
  WITH o AS (SELECT * FROM public.orders x WHERE (v_dsa IS NULL OR x.dsa_id = v_dsa)),
  sold AS (
    SELECT to_char(o.delivered_at AT TIME ZONE 'Africa/Lagos', 'YYYY-MM') m, o.dsa_id, SUM(o.quantity)::int cams, COUNT(*)::int n, SUM(o.total_amount) rev
      FROM o WHERE o.status IN ('delivered','completed') AND o.delivered_at >= v_from GROUP BY 1, 2
  ),
  logged AS (SELECT to_char(o.created_at AT TIME ZONE 'Africa/Lagos', 'YYYY-MM') m, COUNT(*)::int n FROM o WHERE o.created_at >= v_from GROUP BY 1),
  comm AS (SELECT to_char(c.triggered_at AT TIME ZONE 'Africa/Lagos', 'YYYY-MM') m, SUM(c.amount) a FROM public.commissions c
            WHERE (v_dsa IS NULL OR c.dsa_id = v_dsa) AND c.triggered_at >= v_from GROUP BY 1),
  months AS (SELECT m FROM sold UNION SELECT m FROM logged UNION SELECT m FROM comm),
  top AS (SELECT DISTINCT ON (sold.m) sold.m, COALESCE(u.full_name, 'Unregistered') || ' (' || sold.cams || ')' t
            FROM sold LEFT JOIN public.users u ON u.id = sold.dsa_id ORDER BY sold.m, sold.cams DESC)
  SELECT months.m,
         COALESCE((SELECT SUM(sold.cams) FROM sold WHERE sold.m = months.m), 0)::int,
         COALESCE((SELECT SUM(sold.n) FROM sold WHERE sold.m = months.m), 0)::int,
         COALESCE((SELECT SUM(sold.rev) FROM sold WHERE sold.m = months.m), 0),
         COALESCE((SELECT logged.n FROM logged WHERE logged.m = months.m), 0),
         COALESCE((SELECT comm.a FROM comm WHERE comm.m = months.m), 0),
         (SELECT COUNT(DISTINCT sold.dsa_id) FROM sold WHERE sold.m = months.m)::int,
         COALESCE((SELECT top.t FROM top WHERE top.m = months.m), '—')
    FROM months ORDER BY months.m;
END; $$;
GRANT EXECUTE ON FUNCTION public.sales_report(TIMESTAMPTZ, TIMESTAMPTZ, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sales_by_month(UUID, INTEGER) TO authenticated;
REVOKE ALL ON FUNCTION public.sales_report(TIMESTAMPTZ, TIMESTAMPTZ, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.sales_by_month(UUID, INTEGER) FROM anon;

CREATE INDEX IF NOT EXISTS orders_delivered_at ON public.orders(delivered_at) WHERE delivered_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_dsa_created ON public.orders(dsa_id, created_at);

NOTIFY pgrst, 'reload schema';
