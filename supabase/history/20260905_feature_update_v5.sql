-- ============================================================
-- OPTISMART FEATURE UPDATE V5
-- Targeted Account Upgrade & Automated Commission Trigger
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. RPC Procedure to Consolidate Accounts upon User Confirmation in UI
CREATE OR REPLACE FUNCTION public.consolidate_user_accounts(
  primary_email TEXT,
  secondary_email TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_primary_id UUID;
  v_secondary_id UUID;
BEGIN
  IF primary_email IS NULL OR secondary_email IS NULL OR LOWER(primary_email) = LOWER(secondary_email) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid email parameters provided');
  END IF;

  -- Find primary user ID
  SELECT id INTO v_primary_id
    FROM public.users
    WHERE LOWER(email) = LOWER(primary_email)
    LIMIT 1;

  -- Find secondary user ID
  SELECT id INTO v_secondary_id
    FROM public.users
    WHERE LOWER(email) = LOWER(secondary_email)
    LIMIT 1;

  IF v_primary_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Primary account not found');
  END IF;

  -- If secondary account exists, reassign all records to primary account
  IF v_secondary_id IS NOT NULL AND v_secondary_id <> v_primary_id THEN
    -- Reassign orders
    UPDATE public.orders
      SET dsa_id = v_primary_id
      WHERE dsa_id = v_secondary_id;

    -- Reassign leads
    UPDATE public.leads
      SET dsa_id = v_primary_id
      WHERE dsa_id = v_secondary_id;

    -- Reassign commissions
    UPDATE public.commissions
      SET dsa_id = v_primary_id
      WHERE dsa_id = v_secondary_id;

    -- Reassign expenses
    UPDATE public.expenses
      SET dsa_id = v_primary_id
      WHERE dsa_id = v_secondary_id;

    -- Reassign installer jobs if dsa_id column exists
    BEGIN
      UPDATE public.installer_jobs
        SET dsa_id = v_primary_id
        WHERE dsa_id = v_secondary_id;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    -- Reassign LMS progress
    BEGIN
      UPDATE public.lms_user_progress
        SET user_id = v_primary_id
        WHERE user_id = v_secondary_id;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    -- Delete secondary user record from public.users
    DELETE FROM public.users
      WHERE id = v_secondary_id;
  END IF;

  -- Ensure primary user has Admin role with full permissions & personal sales rights
  UPDATE public.users
    SET role = 'admin',
        can_manage_inventory = true,
        can_manage_users = true,
        can_manage_expenses = true,
        can_view_reports = true,
        commission_per_camera = COALESCE(commission_per_camera, 5000),
        status = 'active',
        updated_at = NOW()
    WHERE id = v_primary_id;

  RETURN jsonb_build_object('success', true, 'message', 'Account successfully upgraded and consolidated');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fail-safe Automated Commission Database Trigger
CREATE OR REPLACE FUNCTION public.trigger_auto_commission_on_delivery()
RETURNS TRIGGER AS $$
DECLARE
  v_rate NUMERIC;
  v_quantity INT;
  v_comm_amount NUMERIC;
  v_existing_id UUID;
BEGIN
  -- Only run if order is set to 'delivered' and has an associated dsa_id
  IF NEW.status = 'delivered' AND NEW.dsa_id IS NOT NULL THEN
    
    -- Check if a commission record already exists for this order
    SELECT id INTO v_existing_id
      FROM public.commissions
      WHERE order_id = NEW.id
      LIMIT 1;

    IF v_existing_id IS NULL THEN
      -- Get agent commission rate (defaults to 5000 per camera)
      SELECT COALESCE(commission_per_camera, 5000) INTO v_rate
        FROM public.users
        WHERE id = NEW.dsa_id;

      v_rate := COALESCE(v_rate, 5000);
      v_quantity := COALESCE(NEW.quantity, 1);
      v_comm_amount := v_quantity * v_rate;

      -- Insert pending commission record
      INSERT INTO public.commissions (
        dsa_id,
        order_id,
        amount,
        status,
        triggered_at,
        notes
      ) VALUES (
        NEW.dsa_id,
        NEW.id,
        v_comm_amount,
        'pending',
        NOW(),
        CONCAT('Commission for delivered order #', NEW.order_number)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create trigger safely
DROP TRIGGER IF EXISTS trg_auto_commission_on_delivery ON public.orders;

CREATE TRIGGER trg_auto_commission_on_delivery
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_commission_on_delivery();

-- 3. Reload schema cache
NOTIFY pgrst, 'reload schema';
