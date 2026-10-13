-- Migration: Add Follow-up Reminders to Leads

-- 1. Add follow_up_interval_days
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS follow_up_interval_days INTEGER DEFAULT 0;

-- 2. Add follow_up_stopped
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS follow_up_stopped BOOLEAN DEFAULT FALSE;

-- Notify PostgREST to reload the schema cache so the API picks up the new columns
NOTIFY pgrst, 'reload schema';
