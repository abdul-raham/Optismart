-- OPTISMART: leads arriving from OptiSmart Sales OS (WhatsApp) (22 Oct 2026)
-- OS assigns each WhatsApp enquiry to a closer and posts it here as that DSA's lead; the DSA converts it to an
-- order in the portal. Additive only. Safe to re-run.

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'portal';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS os_lead_id UUID;
-- A plain unique index (NULLs never clash) so OS can upsert on os_lead_id.
DROP INDEX IF EXISTS public.leads_os_lead_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS leads_os_lead_id_key ON public.leads(os_lead_id);

NOTIFY pgrst, 'reload schema';
