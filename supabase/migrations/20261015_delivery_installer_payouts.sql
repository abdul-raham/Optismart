-- OPTISMART: delivery agents, order money (remitted / installation / delivery) and installer payouts (15 Oct 2026)
-- Run once in the Supabase SQL Editor after 20261014_order_sd_cards.sql. Safe to re-run.

BEGIN;

-- ── 1. Delivery agents: a simple list (no login), picked on each order ──────
CREATE TABLE IF NOT EXISTS public.delivery_agents (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name  TEXT NOT NULL,
  phone      TEXT,
  area       TEXT,
  notes      TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.delivery_agents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS delivery_agents_admin ON public.delivery_agents;
CREATE POLICY delivery_agents_admin ON public.delivery_agents FOR ALL
  USING (public.is_admin_user(auth.uid())) WITH CHECK (public.is_admin_user(auth.uid()));

-- ── 2. The money on each order ──────────────────────────────────────────────
-- total_amount = what the customer owes; amount_remitted = what the delivery agent handed back;
-- installation_price = the installation fee; delivery_fee = what we paid for delivery.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_agent_id UUID REFERENCES public.delivery_agents(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS amount_remitted NUMERIC CHECK (amount_remitted >= 0);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS remitted_at TIMESTAMPTZ;

-- ── 3. Installer payouts: earnings add up per job; admin resets them by recording a payout ──
CREATE TABLE IF NOT EXISTS public.installer_payouts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount       NUMERIC NOT NULL CHECK (amount > 0),
  jobs_count   INTEGER NOT NULL DEFAULT 0,
  note         TEXT,
  paid_by      UUID REFERENCES public.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.installer_payouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS installer_payouts_read ON public.installer_payouts;
CREATE POLICY installer_payouts_read ON public.installer_payouts FOR SELECT
  USING (public.is_admin_user(auth.uid()) OR installer_id = public.current_portal_user_id());
-- Payouts are only written by record_installer_payout().

ALTER TABLE public.installer_jobs ADD COLUMN IF NOT EXISTS payout_id UUID REFERENCES public.installer_payouts(id) ON DELETE SET NULL;

-- Installers may update their own job status, but never their pay, payout or who the job belongs to.
CREATE OR REPLACE FUNCTION public.guard_installer_job_pay()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin_user(auth.uid()) THEN RETURN NEW; END IF;
  IF NEW.commission_amount IS DISTINCT FROM OLD.commission_amount
     OR NEW.payout_id IS DISTINCT FROM OLD.payout_id
     OR NEW.installer_id IS DISTINCT FROM OLD.installer_id
     OR NEW.order_id IS DISTINCT FROM OLD.order_id THEN
    RAISE EXCEPTION 'Only an admin can change an installation job''s pay or installer';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_installer_job_pay ON public.installer_jobs;
CREATE TRIGGER trg_guard_installer_job_pay BEFORE UPDATE ON public.installer_jobs
  FOR EACH ROW EXECUTE FUNCTION public.guard_installer_job_pay();

-- Pick (or change, or remove) the installer on an order, with what they are paid for it.
CREATE OR REPLACE FUNCTION public.set_order_installer(p_order_id UUID, p_installer_id UUID, p_amount NUMERIC DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order public.orders; v_job public.installer_jobs; v_amount NUMERIC;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  SELECT * INTO v_job FROM public.installer_jobs
   WHERE order_id = p_order_id AND status <> 'rejected' ORDER BY created_at DESC LIMIT 1 FOR UPDATE;

  IF p_installer_id IS NULL THEN
    IF v_job.id IS NOT NULL THEN
      IF v_job.payout_id IS NOT NULL THEN RAISE EXCEPTION 'This job was already paid out; it cannot be removed'; END IF;
      DELETE FROM public.installer_jobs WHERE id = v_job.id;
    END IF;
    RETURN NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_installer_id AND role = 'installer') THEN
    RAISE EXCEPTION 'That person is not an installer';
  END IF;
  v_amount := COALESCE(p_amount, ROUND(COALESCE(v_order.installation_price, 0) * COALESCE(v_order.installer_commission_pct, 60) / 100));

  IF v_job.id IS NULL THEN
    INSERT INTO public.installer_jobs(installer_id, order_id, scheduled_date, status, commission_amount)
    VALUES (p_installer_id, p_order_id, COALESCE(v_order.expected_delivery_date, CURRENT_DATE + 1), 'assigned', v_amount)
    RETURNING * INTO v_job;
  ELSE
    IF v_job.payout_id IS NOT NULL AND (v_job.installer_id <> p_installer_id OR v_job.commission_amount IS DISTINCT FROM v_amount) THEN
      RAISE EXCEPTION 'This job was already paid out; its installer and pay are locked';
    END IF;
    UPDATE public.installer_jobs SET installer_id = p_installer_id, commission_amount = v_amount, updated_at = NOW()
     WHERE id = v_job.id RETURNING * INTO v_job;
  END IF;
  RETURN v_job.id;
END; $$;

-- What each installer is owed right now (finished jobs not yet paid out).
CREATE OR REPLACE FUNCTION public.installer_job_amount(j public.installer_jobs)
RETURNS NUMERIC LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(j.commission_amount,
         (SELECT ROUND(COALESCE(o.installation_price, 0) * COALESCE(o.installer_commission_pct, 60) / 100)
            FROM public.orders o WHERE o.id = j.order_id), 0);
$$;

-- "Mark as paid": every finished, unpaid job of this installer goes into one payout and their balance resets to ₦0.
CREATE OR REPLACE FUNCTION public.record_installer_payout(p_installer_id UUID, p_note TEXT DEFAULT NULL)
RETURNS public.installer_payouts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total NUMERIC := 0; v_count INTEGER := 0; v_payout public.installer_payouts;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  PERFORM 1 FROM public.installer_jobs
    WHERE installer_id = p_installer_id AND status IN ('installed', 'completed') AND payout_id IS NULL FOR UPDATE;
  UPDATE public.installer_jobs j SET commission_amount = public.installer_job_amount(j)
   WHERE installer_id = p_installer_id AND status IN ('installed', 'completed') AND payout_id IS NULL AND commission_amount IS NULL;
  SELECT COALESCE(SUM(commission_amount), 0), COUNT(*) INTO v_total, v_count FROM public.installer_jobs
   WHERE installer_id = p_installer_id AND status IN ('installed', 'completed') AND payout_id IS NULL;
  IF v_total <= 0 THEN RAISE EXCEPTION 'Nothing to pay: this installer has no unpaid finished jobs'; END IF;

  INSERT INTO public.installer_payouts(installer_id, amount, jobs_count, note, paid_by)
  VALUES (p_installer_id, v_total, v_count, NULLIF(TRIM(p_note), ''), public.current_portal_user_id())
  RETURNING * INTO v_payout;
  UPDATE public.installer_jobs SET payout_id = v_payout.id, updated_at = NOW()
   WHERE installer_id = p_installer_id AND status IN ('installed', 'completed') AND payout_id IS NULL;

  PERFORM public.notify_user(p_installer_id, 'Payout received: ₦' || TO_CHAR(v_total, 'FM999,999,999'),
    v_count || ' installation job(s) paid. Your balance is back to ₦0.', 'commission');
  RETURN v_payout;
END; $$;

GRANT EXECUTE ON FUNCTION public.set_order_installer(UUID, UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_installer_payout(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.installer_job_amount(public.installer_jobs) TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_agents TO authenticated;
GRANT SELECT ON public.installer_payouts TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
