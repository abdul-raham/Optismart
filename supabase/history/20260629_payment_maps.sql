-- Create missing utility functions for RLS if they don't exist
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS UUID
LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claim.sub', true),
    ''
  )::UUID;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = public.current_app_user_id()
    AND role IN ('admin', 'super_admin')
  );
$$;

-- Create system settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  moniepoint_account_name TEXT NOT NULL DEFAULT 'Optismart Networks Ltd',
  moniepoint_account_number TEXT NOT NULL DEFAULT '1234567890',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_settings_read_all" ON public.system_settings;
CREATE POLICY "system_settings_read_all" ON public.system_settings
FOR SELECT USING (true);

DROP POLICY IF EXISTS "system_settings_update_admin" ON public.system_settings;
CREATE POLICY "system_settings_update_admin" ON public.system_settings
FOR UPDATE USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Insert default row if not exists
INSERT INTO public.system_settings (id, moniepoint_account_name, moniepoint_account_number)
VALUES ('default', 'OptiSmart Enterprise', '1098765432')
ON CONFLICT (id) DO NOTHING;


-- Add lat and lng to installer_profiles
ALTER TABLE public.installer_profiles ADD COLUMN IF NOT EXISTS lat DECIMAL(10,6);
ALTER TABLE public.installer_profiles ADD COLUMN IF NOT EXISTS lng DECIMAL(10,6);

-- Seed some mock coordinates for existing installers (Lagos area roughly)
UPDATE public.installer_profiles
SET lat = 6.5244 + (random() * 0.1 - 0.05),
    lng = 3.3792 + (random() * 0.1 - 0.05)
WHERE lat IS NULL;
