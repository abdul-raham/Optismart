-- Add customer_email to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS customer_email TEXT;

-- Notify PostgREST to reload the schema cache so the API picks up the new column immediately
NOTIFY pgrst, 'reload schema';
