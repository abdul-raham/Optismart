-- Monthly profit/loss support.
-- Run once in the Supabase SQL editor before deploying the matching frontend.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cost_price DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_cost_price_nonnegative') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_cost_price_nonnegative CHECK (cost_price >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_unit_cost_nonnegative') THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_unit_cost_nonnegative CHECK (unit_cost >= 0);
  END IF;
END $$;

ALTER TYPE public.expense_category ADD VALUE IF NOT EXISTS 'delivery';
ALTER TYPE public.expense_category ADD VALUE IF NOT EXISTS 'waybill';
ALTER TYPE public.expense_category ADD VALUE IF NOT EXISTS 'advertising';
ALTER TYPE public.expense_category ADD VALUE IF NOT EXISTS 'dsa_salary';

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS dsa_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_dsa_date ON public.expenses(dsa_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_order ON public.expenses(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivered_at ON public.orders(delivered_at);

CREATE OR REPLACE FUNCTION public.snapshot_order_unit_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.product_id IS NOT NULL AND (NEW.unit_cost IS NULL OR NEW.unit_cost = 0) THEN
    SELECT COALESCE(cost_price, 0) INTO NEW.unit_cost
    FROM public.products
    WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_order_unit_cost ON public.orders;
CREATE TRIGGER trg_snapshot_order_unit_cost
BEFORE INSERT OR UPDATE OF product_id ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.snapshot_order_unit_cost();

-- Existing orders keep zero cost until an administrator supplies a product cost.
-- New orders snapshot products.cost_price automatically in the application.
NOTIFY pgrst, 'reload schema';
