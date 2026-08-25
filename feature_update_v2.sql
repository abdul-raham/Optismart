-- ============================================================
-- OPTISMART FEATURE UPDATE V2
-- DSA Performance Window, Probation, Eviction & Targets
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add DSA Target & Performance Window columns to public.users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS expected_orders_target INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS expected_leads_target INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS performance_window_days INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS performance_start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS eviction_warning_day4_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS eviction_alert_day5_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS probation_status TEXT NOT NULL DEFAULT 'active';

-- 2. Ensure default commission_per_camera is 0 for unconfigured users
UPDATE public.users
  SET commission_per_camera = 0
  WHERE role = 'dsa' AND (commission_per_camera IS NULL OR commission_per_camera = 5000);

-- 3. Reload schema cache
NOTIFY pgrst, 'reload schema';
