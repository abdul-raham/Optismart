-- ============================================================
-- OPTISMART FEATURE UPDATE V5
-- Targeted Account Upgrade & Consolidation Procedure
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

-- 2. Reload schema cache
NOTIFY pgrst, 'reload schema';
