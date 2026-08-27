-- SQL script to remove mistakenly added expense record (₦97,500 Facebook ads)

-- 1. Optional: Preview matching expense(s) before deleting
SELECT * FROM public.expenses 
WHERE amount = 97500 
  AND (
    LOWER(COALESCE(description, '')) LIKE '%facebook%' 
    OR LOWER(COALESCE(title, '')) LIKE '%facebook%'
    OR LOWER(COALESCE(category, '')) = 'delivery'
  );

-- 2. Delete the record from public.expenses
DELETE FROM public.expenses 
WHERE amount = 97500 
  AND (
    LOWER(COALESCE(description, '')) LIKE '%facebook%' 
    OR LOWER(COALESCE(title, '')) LIKE '%facebook%'
    OR LOWER(COALESCE(category, '')) = 'delivery'
  );

NOTIFY pgrst, 'reload schema';
