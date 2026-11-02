-- Orders created from a lead can correct the customer's name: the name typed on the order is kept and the lead is
-- updated to match. A blank name still falls back to the lead's. Phone stays tied to the lead.
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
  IF nullif(trim(coalesce(NEW.customer_name, '')), '') IS NULL THEN
    NEW.customer_name := l.customer_name;
  ELSE
    NEW.customer_name := left(trim(NEW.customer_name), 200);
    IF NEW.customer_name IS DISTINCT FROM l.customer_name THEN
      UPDATE public.leads SET customer_name = NEW.customer_name, updated_at = now() WHERE id = l.id;
    END IF;
  END IF;
  NEW.customer_phone := l.phone;
  NEW.customer_email := coalesce(NEW.customer_email,l.email);
  NEW.unit_price := p.retail_price;
  NEW.unit_cost := coalesce(p.cost_price, 0);
  NEW.total_amount := p.retail_price*NEW.quantity
    + coalesce(NEW.installation_price,0)
    + coalesce(NEW.accessory_price,0)*coalesce(NEW.accessory_quantity,0);
  RETURN NEW;
END $$;
