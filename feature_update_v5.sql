-- ============================================================
-- OPTISMART FEATURE UPDATE V5
-- Account Consolidation & Duplicate Account Merge Procedure
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Create reusable Account Merge RPC Procedure
CREATE OR REPLACE FUNCTION public.merge_duplicate_user_accounts(
  primary_user_id UUID,
  duplicate_user_id UUID
)
RETURNS VOID AS $$
BEGIN
  IF primary_user_id IS NULL OR duplicate_user_id IS NULL OR primary_user_id = duplicate_user_id THEN
    RETURN;
  END IF;

  -- Reassign orders
  UPDATE public.orders
    SET dsa_id = primary_user_id
    WHERE dsa_id = duplicate_user_id;

  -- Reassign leads
  UPDATE public.leads
    SET dsa_id = primary_user_id
    WHERE dsa_id = duplicate_user_id;

  -- Reassign commissions
  UPDATE public.commissions
    SET dsa_id = primary_user_id
    WHERE dsa_id = duplicate_user_id;

  -- Reassign expenses
  UPDATE public.expenses
    SET dsa_id = primary_user_id
    WHERE dsa_id = duplicate_user_id;

  -- Reassign installer jobs if dsa_id column exists
  BEGIN
    UPDATE public.installer_jobs
      SET dsa_id = primary_user_id
      WHERE dsa_id = duplicate_user_id;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- ignore if dsa_id column is not in installer_jobs
  END;

  -- Reassign LMS user progress if exists
  BEGIN
    UPDATE public.lms_user_progress
      SET user_id = primary_user_id
      WHERE user_id = duplicate_user_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Delete duplicate user record from public.users
  DELETE FROM public.users
    WHERE id = duplicate_user_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Execute Merge specifically for Abisola Idogbe
DO $$
DECLARE
  v_admin_id UUID := '1ab596bf-7a65-4b23-89d5-626586ce67b1';
  v_dsa_id UUID;
BEGIN
  -- Find duplicate DSA account ID for Abisola
  SELECT id INTO v_dsa_id
    FROM public.users
    WHERE role = 'dsa'
      AND (email ILIKE 'abisolaidogbe@gmail.com' OR phone = '07051205864')
      AND id <> v_admin_id
    LIMIT 1;

  IF v_dsa_id IS NOT NULL THEN
    -- Merge duplicate into primary Admin account
    PERFORM public.merge_duplicate_user_accounts(v_admin_id, v_dsa_id);
    RAISE NOTICE 'Merged DSA account % into Admin account %', v_dsa_id, v_admin_id;
  ELSE
    RAISE NOTICE 'No duplicate DSA account found for Abisola.';
  END IF;

  -- Update email to abisolaidogbe@gmail.com on her Admin profile if needed
  UPDATE public.users
    SET email = 'abisolaidogbe@gmail.com',
        updated_at = NOW()
    WHERE id = v_admin_id
      AND email ILIKE 'abisolaidogbe484@gmail.com';

END $$;

-- 3. Reload schema cache
NOTIFY pgrst, 'reload schema';
