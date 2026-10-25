-- A portal order can be created from an existing lead. The database copies customer/price facts and converts
-- the lead atomically, so agents do not retype names or choose their own sales value.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS orders_lead_id_idx ON public.orders(lead_id) WHERE lead_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.prepare_lead_order() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.leads; p public.products;
BEGIN
  IF NEW.lead_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO l FROM public.leads WHERE id=NEW.lead_id FOR UPDATE;
  IF l.id IS NULL THEN RAISE EXCEPTION 'Lead not found'; END IF;
  IF l.status IN ('converted','lost') THEN RAISE EXCEPTION 'Lead is already closed'; END IF;
  IF NEW.dsa_id IS DISTINCT FROM l.dsa_id THEN RAISE EXCEPTION 'Order must stay with the lead owner'; END IF;
  SELECT * INTO p FROM public.products WHERE id=NEW.product_id AND is_active;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Product is not available'; END IF;
  NEW.customer_name := l.customer_name;
  NEW.customer_phone := l.phone;
  NEW.customer_email := coalesce(NEW.customer_email,l.email);
  NEW.unit_price := p.retail_price;
  NEW.unit_cost := coalesce(p.cost_price, 0);
  NEW.total_amount := p.retail_price*NEW.quantity
    + coalesce(NEW.installation_price,0)
    + coalesce(NEW.accessory_price,0)*coalesce(NEW.accessory_quantity,0);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS prepare_lead_order ON public.orders;
CREATE TRIGGER prepare_lead_order BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.prepare_lead_order();

CREATE OR REPLACE FUNCTION public.convert_lead_from_order() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.lead_id IS NOT NULL THEN
    UPDATE public.leads SET status='converted',converted_order_id=NEW.id,follow_up_stopped=true,updated_at=now()
     WHERE id=NEW.lead_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS convert_lead_from_order ON public.orders;
CREATE TRIGGER convert_lead_from_order AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.convert_lead_from_order();

NOTIFY pgrst, 'reload schema';
