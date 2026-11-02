-- Admin recovery for orders cancelled by mistake.
-- Restoring to pending changes no stock. Restoring to delivered goes through the
-- same atomic stock workflow as an ordinary delivery and preserves movement history.

DROP INDEX IF EXISTS public.stock_movements_one_order_product_stock_out;
CREATE INDEX IF NOT EXISTS stock_movements_order_product_stock_out
  ON public.stock_movements(reference_order_id, product_id, created_at)
  WHERE movement_type = 'stock_out' AND reference_order_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.restore_cancelled_order(
  p_order_id UUID,
  p_new_status TEXT,
  p_location_id UUID DEFAULT NULL,
  p_untracked BOOLEAN DEFAULT false,
  p_reason TEXT DEFAULT NULL
)
RETURNS public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_order public.orders;
  v_out public.orders;
  v_location UUID;
  v_reason TEXT := NULLIF(BTRIM(COALESCE(p_reason, '')), '');
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_new_status NOT IN ('pending', 'delivered') THEN
    RAISE EXCEPTION 'A cancelled order can only be restored to pending or delivered';
  END IF;
  IF v_reason IS NULL THEN RAISE EXCEPTION 'Give a reason for restoring this cancelled order'; END IF;

  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.status <> 'cancelled' THEN
    RAISE EXCEPTION 'Order % is %, not cancelled', v_order.order_number, v_order.status;
  END IF;

  UPDATE public.orders
     SET notes=CONCAT_WS(' ', notes, '[Restored by admin: ' || v_reason || ']'), updated_at=NOW()
   WHERE id=v_order.id
   RETURNING * INTO v_order;

  IF p_new_status = 'pending' THEN
    UPDATE public.orders
       SET status='pending', delivered_at=NULL, stock_untracked=false, updated_at=NOW()
     WHERE id=v_order.id
     RETURNING * INTO v_out;
    RETURN v_out;
  END IF;

  IF p_untracked THEN
    RETURN public._deliver_order(v_order, NULL, true, v_reason);
  END IF;
  v_location := COALESCE(p_location_id, v_order.fulfillment_location_id);
  IF v_location IS NULL THEN RAISE EXCEPTION 'Choose the branch this order ships from'; END IF;
  RETURN public._deliver_order(v_order, v_location, false, 'Restored delivery: ' || v_reason);
END; $$;

REVOKE ALL ON FUNCTION public.restore_cancelled_order(UUID,TEXT,UUID,BOOLEAN,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_cancelled_order(UUID,TEXT,UUID,BOOLEAN,TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
