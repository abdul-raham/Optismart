-- OPTISMART AUTOMATED SYSTEM UPDATES MIGRATION
-- Enables dynamic "What's New" release update popups without code edits.

CREATE TABLE IF NOT EXISTS public.system_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_tag TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.system_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read system updates" ON public.system_updates;
CREATE POLICY "Authenticated users read system updates" ON public.system_updates FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins write system updates" ON public.system_updates;
CREATE POLICY "Admins write system updates" ON public.system_updates FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND LOWER(role::text) IN ('admin', 'super_admin'))
);

GRANT SELECT ON public.system_updates TO authenticated;

-- Seed initial v3.1 update
INSERT INTO public.system_updates (version_tag, title, subtitle, features)
VALUES (
  'v3.1_aug_2026',
  'What''s New in OptiSmart Portal',
  'We''ve deployed major multi-branch inventory, probation review, and performance tracking tools.',
  '[
    {
      "icon": "Package",
      "color": "text-brand-600 bg-brand-50 border-brand-200",
      "title": "🏬 Multi-Branch Inventory & Stock Control",
      "description": "Track camera stock across multiple locations (Lagos HQ, Abuja, PH). Log Stock In, perform inter-branch Stock Transfers, and view stock movement logs.",
      "route": "/app/admin/products"
    },
    {
      "icon": "ShieldCheck",
      "color": "text-emerald-600 bg-emerald-50 border-emerald-200",
      "title": "🛡️ Dedicated Admin Probation Review Panel",
      "description": "Clean admin review card on DSA profiles for agents under the 20-order target. Confirm probation or waive targets with distinct, clear buttons.",
      "route": "/app/admin/users?highlight=probation"
    },
    {
      "icon": "Clock",
      "color": "text-amber-500 bg-amber-50 border-amber-200",
      "title": "⏳ Day 7 Eviction Action Prompt & Clock Pausing",
      "description": "Automated Day 7 safety suspension with an unmissable Eviction Action Banner for admins to either Reset Window or Delete Account. Suspended accounts are automatically excluded from clock countdowns.",
      "route": "/app/admin/users?highlight=performance"
    },
    {
      "icon": "DollarSign",
      "color": "text-cyan-600 bg-cyan-50 border-cyan-200",
      "title": "📢 Ad Spend Allocation & Per-DSA Tracking",
      "description": "Assign specific Sales Agents (DSAs) to Advertising & Marketing expenses. View Total Ad Spend Allocation (₦) and Ad Spend Per Delivered Order on DSA profiles.",
      "route": "/app/admin/expenses"
    },
    {
      "icon": "Sliders",
      "color": "text-indigo-500 bg-indigo-50 border-indigo-200",
      "title": "📱 Clean Products Toolbar & Mobile Responsiveness",
      "description": "Redesigned Products header with segmented tab bar, prominent search bar, and clean responsive toolbar across all admin pages.",
      "route": "/app/admin/products"
    },
    {
      "icon": "ShoppingBag",
      "color": "text-rose-500 bg-rose-50 border-rose-200",
      "title": "📦 Order Fulfillment Stock-Out Integration",
      "description": "Filter orders by Sales Agent. Marking orders DELIVERED automatically deducts camera inventory from selected branch locations.",
      "route": "/app/admin/orders"
    }
  ]'::jsonb
) ON CONFLICT (version_tag) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  features = EXCLUDED.features;

NOTIFY pgrst, 'reload schema';
