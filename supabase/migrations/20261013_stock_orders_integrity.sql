-- OPTISMART: stock, order and commission integrity (13 Oct 2026)
-- Safe to run more than once in the Supabase SQL Editor. Run it in one go.
--
-- Fixes:
--  1. is_admin_user() returned TRUE for every signed-in user (any DSA/installer could change stock). It also looked
--     up public.users by id, but logins map to users.auth_id. It now checks the right column and the real role only.
--  2. Duplicate commissions: the delivery trigger AND the admin screen both inserted one. Existing duplicates are
--     removed (the earliest is kept) and a unique index makes a second one impossible.
--  3. Orders could become delivered/completed without stock leaving a branch (e.g. installer marking a job done).
--     Every delivery now goes through fulfill_order(), which deducts stock atomically; the database refuses any
--     other way. Installers complete jobs through complete_installation_job().
--  4. Cancelling a delivered order never returned the stock. return_delivered_order() restocks the branch it left
--     from and cancels the unpaid commission.
--  5. Orders can carry their branch from the moment they're placed (orders.fulfillment_location_id).

BEGIN;

-- ── 1. Correct admin check ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin_user(p_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE (u.auth_id = p_uid OR u.id = p_uid)
      AND LOWER(REPLACE(u.role::text, ' ', '_')) IN ('admin', 'super_admin')
  );
$$;

-- Admins who are allowed to touch inventory (the per-admin "Manage Inventory" toggle).
CREATE OR REPLACE FUNCTION public.can_manage_inventory(p_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE (u.auth_id = p_uid OR u.id = p_uid)
      AND LOWER(REPLACE(u.role::text, ' ', '_')) IN ('admin', 'super_admin')
      AND COALESCE(u.can_manage_inventory, true)
  );
$$;

-- The portal user behind the current login.
CREATE OR REPLACE FUNCTION public.current_portal_user_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid() OR id = auth.uid() ORDER BY (auth_id = auth.uid()) DESC LIMIT 1;
$$;

-- What's New table: same id/auth_id mistake in its write policy.
DROP POLICY IF EXISTS "Admins write system updates" ON public.system_updates;
CREATE POLICY "Admins write system updates" ON public.system_updates FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid())) WITH CHECK (public.is_admin_user(auth.uid()));

-- ── 2. One commission per order ─────────────────────────────────────────────
DELETE FROM public.commissions c
USING public.commissions keep
WHERE c.order_id IS NOT NULL AND c.order_id = keep.order_id
  AND (keep.created_at, keep.id) < (c.created_at, c.id)
  AND c.status IN ('pending', 'cancelled');  -- never delete an approved/paid record
CREATE UNIQUE INDEX IF NOT EXISTS commissions_one_per_order ON public.commissions(order_id)
  WHERE order_id IS NOT NULL AND status <> 'cancelled';

CREATE OR REPLACE FUNCTION public.trigger_auto_commission_on_delivery()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rate NUMERIC;
BEGIN
  IF NEW.status IN ('delivered', 'completed') AND NEW.dsa_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    SELECT COALESCE(commission_per_camera, 5000) INTO v_rate FROM public.users WHERE id = NEW.dsa_id;
    INSERT INTO public.commissions (dsa_id, order_id, amount, status, triggered_at, notes)
    VALUES (NEW.dsa_id, NEW.id, COALESCE(NEW.quantity, 1) * COALESCE(v_rate, 5000), 'pending', NOW(),
            CONCAT('Commission for delivered order #', NEW.order_number))
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_auto_commission_on_delivery ON public.orders;
CREATE TRIGGER trg_auto_commission_on_delivery AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trigger_auto_commission_on_delivery();

-- ── 3. Stock movement types: returns ────────────────────────────────────────
ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;
ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_movement_type_check
  CHECK (movement_type IN ('stock_in', 'transfer', 'stock_out', 'return', 'adjustment'));

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stock_untracked BOOLEAN NOT NULL DEFAULT false;

-- ── 4. Deliveries only through fulfill_order() ──────────────────────────────
-- A plain UPDATE can no longer move an order into or out of delivered/completed; the functions below set a
-- transaction-local flag that this guard checks.
CREATE OR REPLACE FUNCTION public.guard_order_delivery_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  done_old BOOLEAN := OLD.status IN ('delivered', 'completed');
  done_new BOOLEAN := NEW.status IN ('delivered', 'completed');
BEGIN
  IF done_old = done_new OR current_setting('optismart.stock_flow', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF done_new THEN
    RAISE EXCEPTION 'Mark orders delivered with fulfill_order() so stock leaves a branch (order %)', OLD.order_number;
  END IF;
  RAISE EXCEPTION 'Use return_delivered_order() to cancel a delivered order so its stock is returned (order %)', OLD.order_number;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_order_delivery_status ON public.orders;
CREATE TRIGGER trg_guard_order_delivery_status BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_order_delivery_status();

CREATE OR REPLACE FUNCTION public._deliver_order(p_order public.orders, p_location_id UUID, p_untracked BOOLEAN, p_note TEXT)
RETURNS public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_available INTEGER; v_qty INTEGER := GREATEST(COALESCE(p_order.quantity, 1), 1); v_out public.orders;
BEGIN
  PERFORM set_config('optismart.stock_flow', 'on', true);
  IF NOT p_untracked THEN
    IF p_order.product_id IS NULL THEN RAISE EXCEPTION 'Order % has no product', p_order.order_number; END IF;
    SELECT quantity INTO v_available FROM public.product_inventory
      WHERE product_id = p_order.product_id AND location_id = p_location_id FOR UPDATE;
    IF COALESCE(v_available, 0) < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock: % available at this branch, % needed', COALESCE(v_available, 0), v_qty;
    END IF;
    UPDATE public.product_inventory SET quantity = quantity - v_qty, updated_at = NOW()
      WHERE product_id = p_order.product_id AND location_id = p_location_id;
    INSERT INTO public.stock_movements(movement_type, product_id, quantity, from_location_id, reference_order_id, notes, created_by_auth_id)
      VALUES ('stock_out', p_order.product_id, v_qty, p_location_id, p_order.id, COALESCE(p_note, 'Fulfilling order ' || p_order.order_number), auth.uid());
    PERFORM public.refresh_product_stock(p_order.product_id);
  END IF;
  UPDATE public.orders SET status = 'delivered', delivered_at = NOW(), updated_at = NOW(),
         fulfillment_location_id = CASE WHEN p_untracked THEN fulfillment_location_id ELSE p_location_id END,
         stock_untracked = p_untracked,
         notes = CASE WHEN p_untracked THEN CONCAT_WS(' ', notes, '[Delivered without stock deduction: ' || COALESCE(p_note, 'no reason given') || ']') ELSE notes END
   WHERE id = p_order.id RETURNING * INTO v_out;
  PERFORM set_config('optismart.stock_flow', 'off', true);
  RETURN v_out;
END; $$;

-- Admin delivery. Branch: the one given, else the one chosen when the order was placed.
-- p_untracked=true records a delivery that no branch stock covered (needs a reason; admins only).
CREATE OR REPLACE FUNCTION public.fulfill_order(p_order_id UUID, p_location_id UUID DEFAULT NULL,
                                                p_untracked BOOLEAN DEFAULT false, p_reason TEXT DEFAULT NULL)
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
    RETURN public._deliver_order(v_order, NULL, true, p_reason);
  END IF;
  v_loc := COALESCE(p_location_id, v_order.fulfillment_location_id);
  IF v_loc IS NULL THEN RAISE EXCEPTION 'Choose the branch this order ships from'; END IF;
  RETURN public._deliver_order(v_order, v_loc, false, NULL);
END; $$;

-- Kept for older screens: same behaviour as fulfill_order with a branch.
CREATE OR REPLACE FUNCTION public.fulfill_order_from_location(p_order_id UUID, p_location_id UUID)
RETURNS public.orders LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public.fulfill_order(p_order_id, p_location_id, false, NULL);
$$;

-- Installer finishes a job. Delivers the order from its branch when one was chosen; otherwise the job is marked
-- done and the order waits for an admin to pick the branch. Returns 'delivered' or 'needs_branch'.
CREATE OR REPLACE FUNCTION public.complete_installation_job(p_job_id UUID, p_status TEXT DEFAULT 'completed')
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_job RECORD; v_order public.orders; v_me UUID := public.current_portal_user_id();
BEGIN
  SELECT * INTO v_job FROM public.installer_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job not found'; END IF;
  IF v_job.installer_id IS DISTINCT FROM v_me AND NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Only the assigned installer or an admin can complete this job';
  END IF;
  UPDATE public.installer_jobs SET status = p_status::job_status WHERE id = p_job_id;
  SELECT * INTO v_order FROM public.orders WHERE id = v_job.order_id FOR UPDATE;
  IF v_order.status IN ('delivered', 'completed') THEN RETURN 'delivered'; END IF;
  IF v_order.fulfillment_location_id IS NULL THEN
    UPDATE public.orders SET notes = CONCAT_WS(' ', notes, '[Installed ' || TO_CHAR(NOW(), 'DD Mon') || ' — choose the branch to complete delivery]'),
           updated_at = NOW() WHERE id = v_order.id AND COALESCE(notes, '') NOT LIKE '%choose the branch to complete delivery%';
    RETURN 'needs_branch';
  END IF;
  PERFORM public._deliver_order(v_order, v_order.fulfillment_location_id, false, 'Installed by installer — order ' || v_order.order_number);
  RETURN 'delivered';
END; $$;

-- Cancel or return a delivered order: stock goes back to the branch it left from; unpaid commission is cancelled.
CREATE OR REPLACE FUNCTION public.return_delivered_order(p_order_id UUID, p_restock BOOLEAN DEFAULT true,
                                                         p_reason TEXT DEFAULT NULL, p_new_status TEXT DEFAULT 'cancelled')
RETURNS public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order public.orders; v_qty INTEGER; v_out public.orders;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.status NOT IN ('delivered', 'completed') THEN RAISE EXCEPTION 'Order % is not delivered', v_order.order_number; END IF;
  v_qty := GREATEST(COALESCE(v_order.quantity, 1), 1);
  PERFORM set_config('optismart.stock_flow', 'on', true);
  IF p_restock AND NOT v_order.stock_untracked AND v_order.fulfillment_location_id IS NOT NULL AND v_order.product_id IS NOT NULL THEN
    INSERT INTO public.product_inventory(product_id, location_id, quantity) VALUES (v_order.product_id, v_order.fulfillment_location_id, v_qty)
      ON CONFLICT (product_id, location_id) DO UPDATE SET quantity = product_inventory.quantity + EXCLUDED.quantity, updated_at = NOW();
    INSERT INTO public.stock_movements(movement_type, product_id, quantity, to_location_id, reference_order_id, notes, created_by_auth_id)
      VALUES ('return', v_order.product_id, v_qty, v_order.fulfillment_location_id, v_order.id,
              COALESCE(p_reason, 'Returned from order ' || v_order.order_number), auth.uid());
    PERFORM public.refresh_product_stock(v_order.product_id);
  END IF;
  UPDATE public.commissions SET status = 'cancelled', notes = CONCAT_WS(' ', notes, '[Order returned]')
   WHERE order_id = v_order.id AND status = 'pending';
  UPDATE public.orders SET status = p_new_status::order_status, updated_at = NOW(),
         notes = CONCAT_WS(' ', notes, '[Returned: ' || COALESCE(p_reason, 'no reason given') || ']')
   WHERE id = v_order.id RETURNING * INTO v_out;
  PERFORM set_config('optismart.stock_flow', 'off', true);
  RETURN v_out;
END; $$;

-- ── 5. Inventory tables honour the per-admin "Manage Inventory" toggle ─────

DROP POLICY IF EXISTS "Admins manage inventory locations" ON public.inventory_locations;
CREATE POLICY "Admins manage inventory locations" ON public.inventory_locations FOR ALL TO authenticated
  USING (public.can_manage_inventory(auth.uid())) WITH CHECK (public.can_manage_inventory(auth.uid()));
DROP POLICY IF EXISTS "Admins manage product inventory" ON public.product_inventory;
CREATE POLICY "Admins manage product inventory" ON public.product_inventory FOR ALL TO authenticated
  USING (public.can_manage_inventory(auth.uid())) WITH CHECK (public.can_manage_inventory(auth.uid()));
DROP POLICY IF EXISTS "Admins manage stock movements" ON public.stock_movements;
-- Movements are written only by the functions above (SECURITY DEFINER), never directly.
REVOKE INSERT, UPDATE, DELETE ON public.stock_movements FROM authenticated;

-- ── 6. Notifications, created by the database so every path notifies ───────
-- (Until now nothing ever inserted into public.notifications, so the bell was always empty.)
CREATE OR REPLACE FUNCTION public.notify_user(p_user UUID, p_title TEXT, p_message TEXT, p_type TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_user IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications(user_id, title, message, type)
  VALUES (p_user, LEFT(p_title, 200), LEFT(p_message, 1000), p_type::notification_type);
END; $$;

CREATE OR REPLACE FUNCTION public.trigger_order_notifications()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin RECORD; v_label TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    FOR v_admin IN SELECT id FROM public.users
                   WHERE LOWER(role::text) IN ('admin', 'super_admin') AND id IS DISTINCT FROM NEW.dsa_id LOOP
      PERFORM public.notify_user(v_admin.id, 'New order ' || NEW.order_number,
        COALESCE(NEW.customer_name, 'A customer') || ' · ' || COALESCE(NEW.quantity, 1) || ' item(s)', 'order');
    END LOOP;
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.dsa_id IS NOT NULL THEN
    v_label := INITCAP(REPLACE(NEW.status::text, '_', ' '));
    PERFORM public.notify_user(NEW.dsa_id, 'Order ' || NEW.order_number || ' is now ' || v_label,
      'Order for ' || COALESCE(NEW.customer_name, 'your customer') || ' changed from '
        || INITCAP(OLD.status::text) || ' to ' || v_label || '.', 'order');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_order_notifications ON public.orders;
CREATE TRIGGER trg_order_notifications AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trigger_order_notifications();

CREATE OR REPLACE FUNCTION public.trigger_job_notifications()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order public.orders;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = NEW.order_id;
  IF TG_OP = 'INSERT' OR NEW.installer_id IS DISTINCT FROM OLD.installer_id THEN
    PERFORM public.notify_user(NEW.installer_id, 'New installation job',
      COALESCE(v_order.customer_name, 'A customer') || ' · ' || COALESCE(v_order.customer_address, 'see the job for the address'), 'job');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_job_notifications ON public.installer_jobs;
CREATE TRIGGER trg_job_notifications AFTER INSERT OR UPDATE OF installer_id ON public.installer_jobs
  FOR EACH ROW EXECUTE FUNCTION public.trigger_job_notifications();

CREATE OR REPLACE FUNCTION public.trigger_commission_notifications()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_user(NEW.dsa_id, 'Commission earned: ₦' || TO_CHAR(NEW.amount, 'FM999,999,999'),
      COALESCE(NEW.notes, 'Commission recorded') || ' (pending payout).', 'commission');
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('paid', 'cancelled') THEN
    PERFORM public.notify_user(NEW.dsa_id, 'Commission ' || NEW.status || ': ₦' || TO_CHAR(NEW.amount, 'FM999,999,999'),
      COALESCE(NEW.notes, ''), 'commission');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_commission_notifications ON public.commissions;
CREATE TRIGGER trg_commission_notifications AFTER INSERT OR UPDATE OF status ON public.commissions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_commission_notifications();

-- Live bell: the app can subscribe to new notifications in realtime.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END $$;

-- App screens create notifications through this (it replaces direct calls to the push endpoint).
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link TEXT;
CREATE OR REPLACE FUNCTION public.send_portal_notification(p_user UUID, p_title TEXT, p_message TEXT,
                                                           p_link TEXT DEFAULT '/app', p_type TEXT DEFAULT 'system')
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.current_portal_user_id() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  INSERT INTO public.notifications(user_id, title, message, type, link)
  VALUES (p_user, LEFT(p_title, 200), LEFT(p_message, 1000),
          (CASE WHEN p_type IN ('order', 'job', 'payment', 'system', 'training', 'commission') THEN p_type ELSE 'system' END)::notification_type,
          LEFT(COALESCE(p_link, '/app'), 300));
END; $$;
GRANT EXECUTE ON FUNCTION public.send_portal_notification(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ── 8. Push to phones for every new notification ───────────────────────────
-- The database calls the app's push endpoint with a secret kept in Supabase Vault; the endpoint refuses
-- anything without it (it used to accept requests from anyone).
CREATE EXTENSION IF NOT EXISTS pg_net;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'push_webhook_secret') THEN
    PERFORM vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'push_webhook_secret',
                                'Shared secret between the database and /api/send-web-push');
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.push_webhook_secret() RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'push_webhook_secret' LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.push_webhook_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_webhook_secret() TO service_role;

CREATE OR REPLACE FUNCTION public.trigger_push_on_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://optismart-sigma.vercel.app/api/send-web-push',
    body := jsonb_build_object('user_id', NEW.user_id, 'title', NEW.title, 'body', NEW.message, 'url', COALESCE(NEW.link, '/app')),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', public.push_webhook_secret()));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;  -- a push failure must never block the notification itself
END; $$;
DROP TRIGGER IF EXISTS trg_push_on_notification ON public.notifications;
CREATE TRIGGER trg_push_on_notification AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.trigger_push_on_notification();

-- Links for the notifications the triggers create.
CREATE OR REPLACE FUNCTION public.notify_user(p_user UUID, p_title TEXT, p_message TEXT, p_type TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role TEXT;
BEGIN
  IF p_user IS NULL THEN RETURN; END IF;
  SELECT LOWER(role::text) INTO v_role FROM public.users WHERE id = p_user;
  INSERT INTO public.notifications(user_id, title, message, type, link)
  VALUES (p_user, LEFT(p_title, 200), LEFT(p_message, 1000), p_type::notification_type,
          CASE WHEN p_type = 'job' THEN '/app/installer/jobs'
               WHEN p_type = 'commission' THEN '/app/dsa/commission'
               WHEN v_role IN ('admin', 'super_admin') THEN '/app/admin/orders'
               ELSE '/app/dsa/orders' END);
END; $$;

-- ── 9. What's New: retire the old August announcement that kept reappearing ──
UPDATE public.system_updates SET is_active = false WHERE version_tag = 'v3.1_aug_2026';

GRANT EXECUTE ON FUNCTION public.fulfill_order(UUID, UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_order_from_location(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_installation_job(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.return_delivered_order(UUID, BOOLEAN, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_inventory(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_portal_user_id() TO authenticated;
REVOKE EXECUTE ON FUNCTION public._deliver_order(public.orders, UUID, BOOLEAN, TEXT) FROM PUBLIC, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- After running, check who counts as an admin now (should list only your real admins):
--   SELECT full_name, email, role, auth_id IS NOT NULL AS can_sign_in FROM public.users
--   WHERE public.is_admin_user(auth_id) ORDER BY full_name;
