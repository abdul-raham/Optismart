-- Add new values to order_status enum
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'rescheduled';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'approved';

-- Add new columns to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS installation_needed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS installation_price DECIMAL(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS expected_delivery_date DATE;

-- Allow any authenticated user to see DSAs (so they can populate the DSA dropdown)
CREATE POLICY "users_read_dsas" ON public.users FOR SELECT USING (role = 'dsa');
