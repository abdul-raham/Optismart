-- ============================================================
-- OPTISMART FEATURE UPDATE
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. (installer commission % is set by admin at job assignment time — stored on installer_jobs.commission_amount)
-- No change needed to orders table for this.

-- 2. Add per-DSA commission settings to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS commission_threshold INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS commission_per_camera DECIMAL(12,2) NOT NULL DEFAULT 5000;

-- 3. Create admin_permissions table for super admin access control
CREATE TABLE IF NOT EXISTS public.admin_permissions (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  can_view_orders       BOOLEAN NOT NULL DEFAULT true,
  can_manage_orders     BOOLEAN NOT NULL DEFAULT true,
  can_view_payments     BOOLEAN NOT NULL DEFAULT true,
  can_confirm_payments  BOOLEAN NOT NULL DEFAULT false,
  can_view_users        BOOLEAN NOT NULL DEFAULT true,
  can_manage_users      BOOLEAN NOT NULL DEFAULT false,
  can_view_installers   BOOLEAN NOT NULL DEFAULT true,
  can_assign_installers BOOLEAN NOT NULL DEFAULT true,
  can_view_products     BOOLEAN NOT NULL DEFAULT true,
  can_manage_products   BOOLEAN NOT NULL DEFAULT false,
  can_view_reports      BOOLEAN NOT NULL DEFAULT true,
  can_view_expenses     BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on admin_permissions
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;

-- Only super admins can read/write admin_permissions
CREATE POLICY "admin_permissions_super_admin_only" ON public.admin_permissions
FOR ALL USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 4. Update handle_order_created trigger to use per-DSA threshold & commission
CREATE OR REPLACE FUNCTION public.handle_order_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert order item record
  IF NEW.product_id IS NOT NULL THEN
    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_amount)
    VALUES (NEW.id, NEW.product_id, NEW.quantity, NEW.unit_price, NEW.total_amount)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Insert pending payment record
  INSERT INTO public.payments (order_id, amount, payment_method, reference_code, receipt_number, status)
  VALUES (
    NEW.id,
    NEW.total_amount,
    'bank_transfer',
    'PAY-' || RIGHT(REPLACE(NEW.id::text, '-', ''), 10),
    'RCPT-' || RIGHT(REPLACE(NEW.id::text, '-', ''), 10),
    'pending'
  );

  -- Notify admins about new order
  PERFORM public.notify_admins(
    'New order placed',
    NEW.order_number || ' — ' || NEW.customer_name,
    'order',
    NEW.id
  );

  RETURN NEW;
END;
$$;

-- 5. Update handle_payment_confirmed trigger to use per-DSA threshold
CREATE OR REPLACE FUNCTION public.handle_payment_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_row public.orders%ROWTYPE;
  dsa_row   public.users%ROWTYPE;
  camera_count INTEGER;
  threshold INTEGER;
  per_camera DECIMAL(12,2);
  commission_amount DECIMAL(12,2);
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'confirmed' THEN
    -- Mark order as paid
    UPDATE public.orders SET status = 'paid', payment_confirmed_at = NOW() WHERE id = NEW.order_id;

    SELECT * INTO order_row FROM public.orders WHERE id = NEW.order_id;

    IF order_row.dsa_id IS NOT NULL THEN
      SELECT * INTO dsa_row FROM public.users WHERE id = order_row.dsa_id;

      -- Get DSA's personal threshold and per_camera rate
      threshold   := COALESCE(dsa_row.commission_threshold, 0);
      per_camera  := COALESCE(NULLIF(dsa_row.commission_per_camera, 0), 5000);

      -- Count total cameras sold (delivered) by this DSA this month
      SELECT COALESCE(SUM(o.quantity), 0) INTO camera_count
      FROM public.orders o
      WHERE o.dsa_id = order_row.dsa_id
        AND o.status IN ('delivered', 'completed')
        AND date_trunc('month', o.delivered_at) = date_trunc('month', NOW());

      -- Award commission if threshold is met (0 = no threshold needed)
      IF threshold = 0 OR camera_count >= threshold THEN
        commission_amount := per_camera * order_row.quantity;

        INSERT INTO public.commissions (dsa_id, order_id, amount, status)
        VALUES (order_row.dsa_id, order_row.id, commission_amount, 'pending')
        ON CONFLICT (order_id) DO NOTHING;

        INSERT INTO public.notifications (user_id, title, message, type, related_id)
        VALUES (
          order_row.dsa_id,
          'Commission earned!',
          order_row.order_number || ' — ₦' || commission_amount::text || ' commission pending.',
          'commission',
          order_row.id
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 6. Update installer job trigger to compute commission from percentage
CREATE OR REPLACE FUNCTION public.handle_installer_job_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_row public.orders%ROWTYPE;
  computed_commission DECIMAL(12,2);
BEGIN
  SELECT * INTO order_row FROM public.orders WHERE id = NEW.order_id;

  IF TG_OP = 'INSERT' THEN
    -- Compute installer's commission cut from installation_price × pct
    computed_commission := COALESCE(order_row.installation_price, 0) 
                           * COALESCE(order_row.installer_commission_pct, 60) / 100;

    -- Store it on the job if not already set
    IF NEW.commission_amount IS NULL OR NEW.commission_amount = 0 THEN
      NEW.commission_amount := computed_commission;
    END IF;

    INSERT INTO public.notifications (user_id, title, message, type, related_id)
    VALUES (NEW.installer_id, 'New installation job', 'You have been assigned ' || order_row.order_number, 'job', NEW.id);
  END IF;

  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.completed_at := COALESCE(NEW.completed_at, NOW());
    UPDATE public.installer_profiles
    SET total_jobs = total_jobs + 1, updated_at = NOW()
    WHERE user_id = NEW.installer_id;

    PERFORM public.notify_admins(
      'Installation completed',
      order_row.order_number || ' is ready for delivery confirmation.',
      'job',
      NEW.id
    );
  END IF;

  IF order_row.dsa_id IS NOT NULL AND TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (user_id, title, message, type, related_id)
    VALUES (order_row.dsa_id, 'Installer status updated', order_row.order_number || ' is now ' || NEW.status::text, 'job', NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate the trigger for installer_jobs (BEFORE so we can modify NEW)
DROP TRIGGER IF EXISTS trg_installer_job_change ON public.installer_jobs;
CREATE TRIGGER trg_installer_job_change
BEFORE INSERT OR UPDATE ON public.installer_jobs
FOR EACH ROW EXECUTE FUNCTION public.handle_installer_job_change();

NOTIFY pgrst, 'reload schema';
