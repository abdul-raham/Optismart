-- OPTISMART: the installer job statuses the app uses (16 Oct 2026)
-- The live job_status type only had assigned / in_progress / completed, so Accept, En route, Installed and
-- Decline failed for installers, and set_order_installer / record_installer_payout errored on 'rejected' / 'installed'.
-- Run once in the Supabase SQL Editor. Safe to re-run. (ADD VALUE cannot run inside BEGIN/COMMIT, so no transaction.)

ALTER TYPE public.job_status ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE public.job_status ADD VALUE IF NOT EXISTS 'en_route';
ALTER TYPE public.job_status ADD VALUE IF NOT EXISTS 'installed';
ALTER TYPE public.job_status ADD VALUE IF NOT EXISTS 'rejected';

-- Compare as text from now on, so a missing value can never break these again.
CREATE OR REPLACE FUNCTION public.set_order_installer(p_order_id UUID, p_installer_id UUID, p_amount NUMERIC DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order public.orders; v_job public.installer_jobs; v_amount NUMERIC;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  SELECT * INTO v_job FROM public.installer_jobs
   WHERE order_id = p_order_id AND status::text <> 'rejected' ORDER BY created_at DESC LIMIT 1 FOR UPDATE;

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

CREATE OR REPLACE FUNCTION public.record_installer_payout(p_installer_id UUID, p_note TEXT DEFAULT NULL)
RETURNS public.installer_payouts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total NUMERIC := 0; v_count INTEGER := 0; v_payout public.installer_payouts;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  PERFORM 1 FROM public.installer_jobs
    WHERE installer_id = p_installer_id AND status::text IN ('installed', 'completed') AND payout_id IS NULL FOR UPDATE;
  UPDATE public.installer_jobs j SET commission_amount = public.installer_job_amount(j)
   WHERE installer_id = p_installer_id AND status::text IN ('installed', 'completed') AND payout_id IS NULL AND commission_amount IS NULL;
  SELECT COALESCE(SUM(commission_amount), 0), COUNT(*) INTO v_total, v_count FROM public.installer_jobs
   WHERE installer_id = p_installer_id AND status::text IN ('installed', 'completed') AND payout_id IS NULL;
  IF v_total <= 0 THEN RAISE EXCEPTION 'Nothing to pay: this installer has no unpaid finished jobs'; END IF;

  INSERT INTO public.installer_payouts(installer_id, amount, jobs_count, note, paid_by)
  VALUES (p_installer_id, v_total, v_count, NULLIF(TRIM(p_note), ''), public.current_portal_user_id())
  RETURNING * INTO v_payout;
  UPDATE public.installer_jobs SET payout_id = v_payout.id, updated_at = NOW()
   WHERE installer_id = p_installer_id AND status::text IN ('installed', 'completed') AND payout_id IS NULL;

  PERFORM public.notify_user(p_installer_id, 'Payout received: ₦' || TO_CHAR(v_total, 'FM999,999,999'),
    v_count || ' installation job(s) paid. Your balance is back to ₦0.', 'commission');
  RETURN v_payout;
END; $$;

NOTIFY pgrst, 'reload schema';
