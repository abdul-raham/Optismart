-- OPTISMART FEATURE UPDATE V3
-- Multi-location inventory, attributed ad spend and admin probation confirmation.
-- Safe to run more than once in the Supabase SQL editor.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS probation_approval_status TEXT NOT NULL DEFAULT 'none';

CREATE TABLE IF NOT EXISTS public.inventory_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL UNIQUE, address TEXT,
  phone TEXT, is_active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.product_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.inventory_locations(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0), min_stock_alert INTEGER NOT NULL DEFAULT 5 CHECK (min_stock_alert >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(product_id, location_id)
);
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), movement_type TEXT NOT NULL CHECK (movement_type IN ('stock_in', 'transfer', 'stock_out')),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT, quantity INTEGER NOT NULL CHECK (quantity > 0),
  from_location_id UUID REFERENCES public.inventory_locations(id), to_location_id UUID REFERENCES public.inventory_locations(id),
  reference_order_id UUID REFERENCES public.orders(id) ON DELETE RESTRICT, notes TEXT,
  created_by_auth_id UUID REFERENCES public.users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfillment_location_id UUID REFERENCES public.inventory_locations(id);
CREATE UNIQUE INDEX IF NOT EXISTS stock_movements_one_order_stock_out ON public.stock_movements(reference_order_id)
  WHERE movement_type = 'stock_out' AND reference_order_id IS NOT NULL;

-- Do not invent opening balances. Admins capture real quantities with Stock In.
INSERT INTO public.inventory_locations (name, address) VALUES ('Lagos HQ', 'Main Warehouse, Lagos') ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.refresh_product_stock(p_product_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.products SET stock_quantity = COALESCE((SELECT SUM(quantity) FROM public.product_inventory WHERE product_id = p_product_id), 0)
  WHERE id = p_product_id;
END; $$;

CREATE OR REPLACE FUNCTION public.inventory_create_location(p_name TEXT, p_address TEXT DEFAULT NULL, p_phone TEXT DEFAULT NULL)
RETURNS public.inventory_locations LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_location public.inventory_locations;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF BTRIM(COALESCE(p_name, '')) = '' THEN RAISE EXCEPTION 'Location name is required'; END IF;
  INSERT INTO public.inventory_locations(name, address, phone) VALUES (BTRIM(p_name), NULLIF(BTRIM(p_address), ''), NULLIF(BTRIM(p_phone), ''))
    RETURNING * INTO v_location;
  RETURN v_location;
END; $$;

CREATE OR REPLACE FUNCTION public.inventory_stock_in(p_product_id UUID, p_location_id UUID, p_quantity INTEGER, p_notes TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be greater than zero'; END IF;
  INSERT INTO public.product_inventory(product_id, location_id, quantity) VALUES (p_product_id, p_location_id, p_quantity)
  ON CONFLICT (product_id, location_id) DO UPDATE SET quantity = product_inventory.quantity + EXCLUDED.quantity, updated_at = NOW();
  INSERT INTO public.stock_movements(movement_type, product_id, quantity, to_location_id, notes, created_by_auth_id)
  VALUES ('stock_in', p_product_id, p_quantity, p_location_id, p_notes, auth.uid());
  PERFORM public.refresh_product_stock(p_product_id);
END; $$;

CREATE OR REPLACE FUNCTION public.inventory_transfer(p_product_id UUID, p_from_location_id UUID, p_to_location_id UUID, p_quantity INTEGER, p_notes TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_available INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be greater than zero'; END IF;
  IF p_from_location_id = p_to_location_id THEN RAISE EXCEPTION 'Locations must be different'; END IF;
  SELECT quantity INTO v_available FROM public.product_inventory WHERE product_id = p_product_id AND location_id = p_from_location_id FOR UPDATE;
  IF COALESCE(v_available, 0) < p_quantity THEN RAISE EXCEPTION 'Insufficient stock: % available, % requested', COALESCE(v_available, 0), p_quantity; END IF;
  UPDATE public.product_inventory SET quantity = quantity - p_quantity, updated_at = NOW() WHERE product_id = p_product_id AND location_id = p_from_location_id;
  INSERT INTO public.product_inventory(product_id, location_id, quantity) VALUES (p_product_id, p_to_location_id, p_quantity)
  ON CONFLICT (product_id, location_id) DO UPDATE SET quantity = product_inventory.quantity + EXCLUDED.quantity, updated_at = NOW();
  INSERT INTO public.stock_movements(movement_type, product_id, quantity, from_location_id, to_location_id, notes, created_by_auth_id)
  VALUES ('transfer', p_product_id, p_quantity, p_from_location_id, p_to_location_id, p_notes, auth.uid());
END; $$;

CREATE OR REPLACE FUNCTION public.fulfill_order_from_location(p_order_id UUID, p_location_id UUID) RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order public.orders; v_available INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.status = 'delivered' THEN RAISE EXCEPTION 'Order has already been delivered'; END IF;
  IF v_order.product_id IS NULL THEN RAISE EXCEPTION 'Order has no product'; END IF;
  SELECT quantity INTO v_available FROM public.product_inventory WHERE product_id = v_order.product_id AND location_id = p_location_id FOR UPDATE;
  IF COALESCE(v_available, 0) < COALESCE(v_order.quantity, 1) THEN
    RAISE EXCEPTION 'Insufficient stock: % available, % required', COALESCE(v_available, 0), COALESCE(v_order.quantity, 1);
  END IF;
  UPDATE public.product_inventory SET quantity = quantity - COALESCE(v_order.quantity, 1), updated_at = NOW()
    WHERE product_id = v_order.product_id AND location_id = p_location_id;
  INSERT INTO public.stock_movements(movement_type, product_id, quantity, from_location_id, reference_order_id, notes, created_by_auth_id)
  VALUES ('stock_out', v_order.product_id, COALESCE(v_order.quantity, 1), p_location_id, v_order.id, 'Order ' || v_order.order_number, auth.uid());
  UPDATE public.orders SET status = 'delivered', delivered_at = NOW(), updated_at = NOW(), fulfillment_location_id = p_location_id
    WHERE id = p_order_id RETURNING * INTO v_order;
  PERFORM public.refresh_product_stock(v_order.product_id);
  RETURN v_order;
END; $$;

ALTER TABLE public.inventory_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read inventory locations" ON public.inventory_locations;
CREATE POLICY "Authenticated users can read inventory locations" ON public.inventory_locations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can read product inventory" ON public.product_inventory;
CREATE POLICY "Authenticated users can read product inventory" ON public.product_inventory FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can read stock movements" ON public.stock_movements;
CREATE POLICY "Authenticated users can read stock movements" ON public.stock_movements FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.inventory_locations, public.product_inventory, public.stock_movements TO authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_stock_in(UUID, UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_create_location(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_transfer(UUID, UUID, UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_order_from_location(UUID, UUID) TO authenticated;
NOTIFY pgrst, 'reload schema';
