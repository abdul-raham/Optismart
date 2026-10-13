ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS specs TEXT[];
