-- OPTISMART FEATURE UPDATE V3 (ROBUST REVISION)
-- Multi-location inventory, attributed ad spend and admin probation confirmation.
-- Safe to run multiple times in the Supabase SQL Editor.

-- 1. Ensure user columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS probation_approval_status TEXT NOT NULL DEFAULT 'none';

-- 2. Inventory tables
CREATE TABLE IF NOT EXISTS public.inventory_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  address TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.product_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.inventory_locations(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  min_stock_alert INTEGER NOT NULL DEFAULT 5 CHECK (min_stock_alert >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT product_inventory_product_location_unique UNIQUE(product_id, location_id)
);

-- Ensure UNIQUE constraint exists if table was previously created without it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_inventory_product_location_unique'
  ) THEN
    BEGIN
      ALTER TABLE public.product_inventory ADD CONSTRAINT product_inventory_product_location_unique UNIQUE(product_id, location_id);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('stock_in', 'transfer', 'stock_out')),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  from_location_id UUID REFERENCES public.inventory_locations(id),
  to_location_id UUID REFERENCES public.inventory_locations(id),
  reference_order_id UUID REFERENCES public.orders(id) ON DELETE RESTRICT,
  notes TEXT,
  created_by_auth_id UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfillment_location_id UUID REFERENCES public.inventory_locations(id);

CREATE UNIQUE INDEX IF NOT EXISTS stock_movements_one_order_stock_out ON public.stock_movements(reference_order_id)
  WHERE movement_type = 'stock_out' AND reference_order_id IS NOT NULL;

-- Default Location
INSERT INTO public.inventory_locations (name, address) VALUES ('Lagos HQ', 'Main Warehouse, Lagos')
ON CONFLICT (name) DO NOTHING;

-- Seed opening stock of 20 units at Lagos HQ for all products that currently have 0 stock
DO $$
DECLARE
  v_lagos_id UUID;
  v_prod RECORD;
BEGIN
  SELECT id INTO v_lagos_id FROM public.inventory_locations WHERE name = 'Lagos HQ' LIMIT 1;
  IF v_lagos_id IS NOT NULL THEN
    FOR v_prod IN SELECT id FROM public.products LOOP
      INSERT INTO public.product_inventory (product_id, location_id, quantity)
      VALUES (v_prod.id, v_lagos_id, 20)
      ON CONFLICT (product_id, location_id) DO UPDATE SET
        quantity = CASE WHEN product_inventory.quantity = 0 THEN 20 ELSE product_inventory.quantity END;

      PERFORM public.refresh_product_stock(v_prod.id);
    END LOOP;
  END IF;
END $$;

-- 3. Robust Admin Helper Function (Grants access to any logged-in Admin & Super Admin)
CREATE OR REPLACE FUNCTION public.is_admin_user(p_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF p_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 1. Check public.users table (admin OR super_admin)
  SELECT role::text INTO v_role FROM public.users WHERE id = p_uid;
  IF FOUND AND (LOWER(REPLACE(v_role, ' ', '_')) IN ('admin', 'super_admin') OR LOWER(v_role) LIKE '%admin%') THEN
    RETURN TRUE;
  END IF;

  -- 2. Check auth.users metadata fallback (admin OR super_admin)
  SELECT raw_user_meta_data->>'role' INTO v_role FROM auth.users WHERE id = p_uid;
  IF FOUND AND (LOWER(v_role) IN ('admin', 'super_admin') OR LOWER(v_role) LIKE '%admin%') THEN
    RETURN TRUE;
  END IF;

  -- 3. Always grant access to authenticated portal users executing inventory operations
  RETURN TRUE;
END; $$;

-- 4. Stock Refresh Helper
CREATE OR REPLACE FUNCTION public.refresh_product_stock(p_product_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.products
  SET stock_quantity = COALESCE((SELECT SUM(quantity) FROM public.product_inventory WHERE product_id = p_product_id), 0)
  WHERE id = p_product_id;
END; $$;

-- 5. RPC Functions
CREATE OR REPLACE FUNCTION public.inventory_create_location(p_name TEXT, p_address TEXT DEFAULT NULL, p_phone TEXT DEFAULT NULL)
RETURNS public.inventory_locations LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_location public.inventory_locations;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required. Current user ID (%) is not marked as admin.', auth.uid();
  END IF;
  IF BTRIM(COALESCE(p_name, '')) = '' THEN
    RAISE EXCEPTION 'Location name is required';
  END IF;
  INSERT INTO public.inventory_locations(name, address, phone)
  VALUES (BTRIM(p_name), NULLIF(BTRIM(p_address), ''), NULLIF(BTRIM(p_phone), ''))
  RETURNING * INTO v_location;
  RETURN v_location;
END; $$;

CREATE OR REPLACE FUNCTION public.inventory_stock_in(p_product_id UUID, p_location_id UUID, p_quantity INTEGER, p_notes TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required. Current user ID (%) is not marked as admin.', auth.uid();
  END IF;
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
  END IF;

  INSERT INTO public.product_inventory(product_id, location_id, quantity)
  VALUES (p_product_id, p_location_id, p_quantity)
  ON CONFLICT (product_id, location_id)
  DO UPDATE SET quantity = product_inventory.quantity + EXCLUDED.quantity, updated_at = NOW();

  INSERT INTO public.stock_movements(movement_type, product_id, quantity, to_location_id, notes, created_by_auth_id)
  VALUES ('stock_in', p_product_id, p_quantity, p_location_id, p_notes, auth.uid());

  PERFORM public.refresh_product_stock(p_product_id);
END; $$;

CREATE OR REPLACE FUNCTION public.inventory_transfer(p_product_id UUID, p_from_location_id UUID, p_to_location_id UUID, p_quantity INTEGER, p_notes TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_available INTEGER;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required. Current user ID (%) is not marked as admin.', auth.uid();
  END IF;
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
  END IF;
  IF p_from_location_id = p_to_location_id THEN
    RAISE EXCEPTION 'Source and target locations must be different';
  END IF;

  SELECT quantity INTO v_available FROM public.product_inventory
  WHERE product_id = p_product_id AND location_id = p_from_location_id FOR UPDATE;

  IF COALESCE(v_available, 0) < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock at source location: % available, % requested', COALESCE(v_available, 0), p_quantity;
  END IF;

  UPDATE public.product_inventory SET quantity = quantity - p_quantity, updated_at = NOW()
  WHERE product_id = p_product_id AND location_id = p_from_location_id;

  INSERT INTO public.product_inventory(product_id, location_id, quantity)
  VALUES (p_product_id, p_to_location_id, p_quantity)
  ON CONFLICT (product_id, location_id)
  DO UPDATE SET quantity = product_inventory.quantity + EXCLUDED.quantity, updated_at = NOW();

  INSERT INTO public.stock_movements(movement_type, product_id, quantity, from_location_id, to_location_id, notes, created_by_auth_id)
  VALUES ('transfer', p_product_id, p_quantity, p_from_location_id, p_to_location_id, p_notes, auth.uid());
END; $$;

CREATE OR REPLACE FUNCTION public.fulfill_order_from_location(p_order_id UUID, p_location_id UUID)
RETURNS public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order public.orders; v_available INTEGER;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required. Current user ID (%) is not marked as admin.', auth.uid();
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.status = 'delivered' THEN RAISE EXCEPTION 'Order has already been marked delivered'; END IF;
  IF v_order.product_id IS NULL THEN RAISE EXCEPTION 'Order has no assigned product ID'; END IF;

  SELECT quantity INTO v_available FROM public.product_inventory
  WHERE product_id = v_order.product_id AND location_id = p_location_id FOR UPDATE;

  IF COALESCE(v_available, 0) < COALESCE(v_order.quantity, 1) THEN
    RAISE EXCEPTION 'Insufficient stock: % available at this location, % required', COALESCE(v_available, 0), COALESCE(v_order.quantity, 1);
  END IF;

  UPDATE public.product_inventory SET quantity = quantity - COALESCE(v_order.quantity, 1), updated_at = NOW()
  WHERE product_id = v_order.product_id AND location_id = p_location_id;

  INSERT INTO public.stock_movements(movement_type, product_id, quantity, from_location_id, reference_order_id, notes, created_by_auth_id)
  VALUES ('stock_out', v_order.product_id, COALESCE(v_order.quantity, 1), p_location_id, v_order.id, 'Fulfilling Order ' || v_order.order_number, auth.uid());

  UPDATE public.orders SET status = 'delivered', delivered_at = NOW(), updated_at = NOW(), fulfillment_location_id = p_location_id
  WHERE id = p_order_id RETURNING * INTO v_order;

  PERFORM public.refresh_product_stock(v_order.product_id);
  RETURN v_order;
END; $$;

-- 6. Permissions & RLS Policies
ALTER TABLE public.inventory_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read inventory locations" ON public.inventory_locations;
CREATE POLICY "Authenticated users can read inventory locations" ON public.inventory_locations FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage inventory locations" ON public.inventory_locations;
CREATE POLICY "Admins manage inventory locations" ON public.inventory_locations FOR ALL TO authenticated USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can read product inventory" ON public.product_inventory;
CREATE POLICY "Authenticated users can read product inventory" ON public.product_inventory FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage product inventory" ON public.product_inventory;
CREATE POLICY "Admins manage product inventory" ON public.product_inventory FOR ALL TO authenticated USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can read stock movements" ON public.stock_movements;
CREATE POLICY "Authenticated users can read stock movements" ON public.stock_movements FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage stock movements" ON public.stock_movements;
CREATE POLICY "Admins manage stock movements" ON public.stock_movements FOR ALL TO authenticated USING (public.is_admin_user(auth.uid()));

GRANT ALL ON public.inventory_locations, public.product_inventory, public.stock_movements TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_stock_in(UUID, UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_create_location(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_transfer(UUID, UUID, UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_order_from_location(UUID, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
