-- SQL script to delete the exact mistaken Facebook Ads expense under "delivery" category

-- Exact Record ID: 1168be4e-7e7e-4dc6-8b0a-23c26a586a3a
-- Description: Facebook ads | Category: delivery | Amount: 97500.00 | Date: 2026-08-26

DELETE FROM public.expenses 
WHERE id = '1168be4e-7e7e-4dc6-8b0a-23c26a586a3a';

NOTIFY pgrst, 'reload schema';
