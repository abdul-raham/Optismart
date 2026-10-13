-- OPTISMART FEATURE UPDATE V4
-- Granular Super Admin Permission Toggles & Physical Stock Audit Override
-- Safe to run multiple times in the Supabase SQL Editor.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS can_manage_inventory BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS can_manage_users BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS can_manage_expenses BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS can_view_reports BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS can_delete_records BOOLEAN NOT NULL DEFAULT false;

-- Direct Stock Count Override (Set Physical Inventory Count)
CREATE OR REPLACE FUNCTION public.inventory_set_physical_count(
  p_product_id UUID,
  p_location_id UUID,
  p_target_quantity INTEGER,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_qty INTEGER := 0;
  v_diff INTEGER := 0;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required. Current user ID (%) is not marked as admin.', auth.uid();
  END IF;

  IF p_target_quantity < 0 THEN
    RAISE EXCEPTION 'Target physical quantity cannot be negative';
  END IF;

  SELECT COALESCE(quantity, 0) INTO v_old_qty
  FROM public.product_inventory
  WHERE product_id = p_product_id AND location_id = p_location_id;

  v_diff := p_target_quantity - v_old_qty;

  INSERT INTO public.product_inventory (product_id, location_id, quantity, updated_at)
  VALUES (p_product_id, p_location_id, p_target_quantity, NOW())
  ON CONFLICT (product_id, location_id)
  DO UPDATE SET quantity = p_target_quantity, updated_at = NOW();

  IF v_diff != 0 THEN
    INSERT INTO public.stock_movements(movement_type, product_id, quantity, to_location_id, notes, created_by_auth_id)
    VALUES (
      CASE WHEN v_diff >= 0 THEN 'stock_in' ELSE 'stock_out' END,
      p_product_id,
      ABS(v_diff),
      p_location_id,
      COALESCE(p_notes, 'Physical Stock Count Audit (Set to ' || p_target_quantity || ' units, previous: ' || v_old_qty || ')'),
      auth.uid()
    );
  END IF;

  PERFORM public.refresh_product_stock(p_product_id);
END; $$;

GRANT EXECUTE ON FUNCTION public.inventory_set_physical_count(UUID, UUID, INTEGER, TEXT) TO authenticated;
