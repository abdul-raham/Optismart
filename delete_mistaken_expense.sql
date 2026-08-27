-- SQL script to delete mistakenly logged Facebook Ads expenses under "delivery" category

-- Record 1 (₦97,500 on Aug 26 under delivery): 1168be4e-7e7e-4dc6-8b0a-23c26a586a3a
-- Record 2 (₦107,500 on Aug 25 under delivery): 89b1252b-ada7-4a04-87f0-33638dc94821

DELETE FROM public.expenses 
WHERE id IN (
  '1168be4e-7e7e-4dc6-8b0a-23c26a586a3a',
  '89b1252b-ada7-4a04-87f0-33638dc94821'
);

NOTIFY pgrst, 'reload schema';
