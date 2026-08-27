-- ============================================================
-- OPTISMART FEATURE UPDATE V3
-- Multi-Location Inventory, Ad Spend Tracking & Admin Probation Confirmation
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add Probation Approval status to public.users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS probation_approval_status TEXT NOT NULL DEFAULT 'none';

-- 2. Create Inventory Locations Table
CREATE TABLE IF NOT EXISTS public.inventory_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  address TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Default Locations
INSERT INTO public.inventory_locations (name, address) VALUES
  ('Lagos HQ', 'Main Warehouse, Lagos'),
  ('Abuja Branch', 'Abuja Regional Depot'),
  ('Port Harcourt Branch', 'Port Harcourt Hub')
ON CONFLICT (name) DO NOTHING;

-- 3. Create Product Inventory Table (Stock per location)
CREATE TABLE IF NOT EXISTS public.product_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.inventory_locations(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  min_stock_alert INTEGER DEFAULT 5,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, location_id)
);

-- Seed stock records for existing products across locations
INSERT INTO public.product_inventory (product_id, location_id, quantity)
SELECT p.id, l.id, 10
FROM public.products p
CROSS JOIN public.inventory_locations l
ON CONFLICT (product_id, location_id) DO NOTHING;

-- 4. Create Stock Movements Table (Stock In, Transfer, Stock Out)
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('stock_in', 'transfer', 'stock_out')),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  from_location_id UUID REFERENCES public.inventory_locations(id),
  to_location_id UUID REFERENCES public.inventory_locations(id),
  reference_order_id UUID REFERENCES public.orders(id),
  notes TEXT,
  created_by_auth_id UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Reload Schema Cache
NOTIFY pgrst, 'reload schema';
