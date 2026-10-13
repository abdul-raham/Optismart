-- OPTISMART: SD cards (or any accessory) on orders, deducted from the same branch on delivery (14 Oct 2026)
-- Run once in the Supabase SQL Editor after 20261013_stock_orders_integrity.sql. Safe to re-run.

BEGIN;

-- Product groups: cameras, SD cards and other accessories, so new SD cards (32GB, 128GB…) sit under "SD cards".
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'camera';
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_category_check;
ALTER TABLE public.products ADD CONSTRAINT products_category_check CHECK (category IN ('camera', 'sd_card', 'accessory'));
UPDATE public.products SET category = 'sd_card'
 WHERE category = 'camera' AND name ~* '(memory card|sd card|micro ?sd|\m\d+ ?gb?\M.*card)';

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS accessory_product_id UUID REFERENCES public.products(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS accessory_quantity INTEGER NOT NULL DEFAULT 0 CHECK (accessory_quantity >= 0);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS accessory_price NUMERIC NOT NULL DEFAULT 0 CHECK (accessory_price >= 0);

-- An order now has one stock-out per product (camera + SD card), not one in total.
DROP INDEX IF EXISTS public.stock_movements_one_order_stock_out;
CREATE UNIQUE INDEX IF NOT EXISTS stock_movements_one_order_product_stock_out
  ON public.stock_movements(reference_order_id, product_id)
  WHERE movement_type = 'stock_out' AND reference_order_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public._take_stock(p_product UUID, p_location UUID, p_qty INTEGER, p_order public.orders, p_label TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_available INTEGER;
BEGIN
  SELECT quantity INTO v_available FROM public.product_inventory
    WHERE product_id = p_product AND location_id = p_location FOR UPDATE;
  IF COALESCE(v_available, 0) < p_qty THEN
    RAISE EXCEPTION 'Not enough % at this branch: % available, % needed', p_label, COALESCE(v_available, 0), p_qty;
  END IF;
  UPDATE public.product_inventory SET quantity = quantity - p_qty, updated_at = NOW()
    WHERE product_id = p_product AND location_id = p_location;
  INSERT INTO public.stock_movements(movement_type, product_id, quantity, from_location_id, reference_order_id, notes, created_by_auth_id)
    VALUES ('stock_out', p_product, p_qty, p_location, p_order.id, 'Fulfilling order ' || p_order.order_number || ' (' || p_label || ')', auth.uid());
  PERFORM public.refresh_product_stock(p_product);
END; $$;

CREATE OR REPLACE FUNCTION public._deliver_order(p_order public.orders, p_location_id UUID, p_untracked BOOLEAN, p_note TEXT)
RETURNS public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_out public.orders;
BEGIN
  PERFORM set_config('optismart.stock_flow', 'on', true);
  IF NOT p_untracked THEN
    IF p_order.product_id IS NULL THEN RAISE EXCEPTION 'Order % has no product', p_order.order_number; END IF;
    PERFORM public._take_stock(p_order.product_id, p_location_id, GREATEST(COALESCE(p_order.quantity, 1), 1), p_order, 'cameras');
    IF p_order.accessory_product_id IS NOT NULL AND p_order.accessory_quantity > 0 THEN
      PERFORM public._take_stock(p_order.accessory_product_id, p_location_id, p_order.accessory_quantity, p_order, 'SD cards');
    END IF;
  END IF;
  UPDATE public.orders SET status = 'delivered', delivered_at = NOW(), updated_at = NOW(),
         fulfillment_location_id = CASE WHEN p_untracked THEN fulfillment_location_id ELSE p_location_id END,
         stock_untracked = p_untracked,
         notes = CASE WHEN p_untracked THEN CONCAT_WS(' ', notes, '[Delivered without stock deduction: ' || COALESCE(p_note, 'no reason given') || ']') ELSE notes END
   WHERE id = p_order.id RETURNING * INTO v_out;
  PERFORM set_config('optismart.stock_flow', 'off', true);
  RETURN v_out;
END; $$;

CREATE OR REPLACE FUNCTION public._give_back(p_product UUID, p_location UUID, p_qty INTEGER, p_order public.orders, p_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.product_inventory(product_id, location_id, quantity) VALUES (p_product, p_location, p_qty)
    ON CONFLICT (product_id, location_id) DO UPDATE SET quantity = product_inventory.quantity + EXCLUDED.quantity, updated_at = NOW();
  INSERT INTO public.stock_movements(movement_type, product_id, quantity, to_location_id, reference_order_id, notes, created_by_auth_id)
    VALUES ('return', p_product, p_qty, p_location, p_order.id, COALESCE(p_reason, 'Returned from order ' || p_order.order_number), auth.uid());
  PERFORM public.refresh_product_stock(p_product);
END; $$;

CREATE OR REPLACE FUNCTION public.return_delivered_order(p_order_id UUID, p_restock BOOLEAN DEFAULT true,
                                                         p_reason TEXT DEFAULT NULL, p_new_status TEXT DEFAULT 'cancelled')
RETURNS public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order public.orders; v_out public.orders;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.status NOT IN ('delivered', 'completed') THEN RAISE EXCEPTION 'Order % is not delivered', v_order.order_number; END IF;
  PERFORM set_config('optismart.stock_flow', 'on', true);
  IF p_restock AND NOT v_order.stock_untracked AND v_order.fulfillment_location_id IS NOT NULL THEN
    IF v_order.product_id IS NOT NULL THEN
      PERFORM public._give_back(v_order.product_id, v_order.fulfillment_location_id, GREATEST(COALESCE(v_order.quantity, 1), 1), v_order, p_reason);
    END IF;
    IF v_order.accessory_product_id IS NOT NULL AND v_order.accessory_quantity > 0 THEN
      PERFORM public._give_back(v_order.accessory_product_id, v_order.fulfillment_location_id, v_order.accessory_quantity, v_order, p_reason);
    END IF;
  END IF;
  UPDATE public.commissions SET status = 'cancelled', notes = CONCAT_WS(' ', notes, '[Order returned]')
   WHERE order_id = v_order.id AND status = 'pending';
  UPDATE public.orders SET status = p_new_status::order_status, updated_at = NOW(),
         notes = CONCAT_WS(' ', notes, '[Returned: ' || COALESCE(p_reason, 'no reason given') || ']')
   WHERE id = v_order.id RETURNING * INTO v_out;
  PERFORM set_config('optismart.stock_flow', 'off', true);
  RETURN v_out;
END; $$;

REVOKE EXECUTE ON FUNCTION public._take_stock(UUID, UUID, INTEGER, public.orders, TEXT) FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION public._give_back(UUID, UUID, INTEGER, public.orders, TEXT) FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION public._deliver_order(public.orders, UUID, BOOLEAN, TEXT) FROM PUBLIC, authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
