-- ==============================================================================
-- OPTISMART PORTAL V3 - PRODUCTION SUPABASE MIGRATION
-- ==============================================================================
-- Fresh-project migration. Run before supabase_seed.sql.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. ENUMS
-- ==========================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'dsa', 'installer', 'reseller');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'converted', 'lost');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE lead_temp AS ENUM ('hot', 'warm', 'cold');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'processing', 'dispatched', 'delivered', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE job_status AS ENUM ('assigned', 'accepted', 'en_route', 'installed', 'completed', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'confirmed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE commission_status AS ENUM ('pending', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('order', 'job', 'payment', 'system', 'training', 'commission');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE expense_category AS ENUM ('logistics', 'marketing', 'salaries', 'utilities', 'equipment', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ==========================================
-- 2. CORE TABLES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'dsa',
  status user_status NOT NULL DEFAULT 'inactive',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.installer_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  location TEXT NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  rating DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  total_jobs INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  retail_price DECIMAL(12,2) NOT NULL CHECK (retail_price >= 0),
  wholesale_price DECIMAL(12,2) NOT NULL CHECK (wholesale_price >= 0),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  min_stock_level INTEGER NOT NULL DEFAULT 5 CHECK (min_stock_level >= 0),
  image_url TEXT,
  source_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dsa_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  location TEXT,
  status lead_status NOT NULL DEFAULT 'new',
  temperature lead_temp NOT NULL DEFAULT 'warm',
  notes TEXT,
  follow_up_date TIMESTAMPTZ,
  converted_order_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT UNIQUE NOT NULL,
  dsa_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reseller_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price DECIMAL(12,2) NOT NULL CHECK (unit_price >= 0),
  total_amount DECIMAL(12,2) NOT NULL CHECK (total_amount >= 0),
  status order_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  payment_confirmed_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS fk_lead_order;
ALTER TABLE public.leads
  ADD CONSTRAINT fk_lead_order FOREIGN KEY (converted_order_id) REFERENCES public.orders(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(12,2) NOT NULL CHECK (unit_price >= 0),
  total_amount DECIMAL(12,2) NOT NULL CHECK (total_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
  reference_code TEXT,
  receipt_number TEXT UNIQUE,
  status payment_status NOT NULL DEFAULT 'pending',
  confirmed_by UUID REFERENCES public.users(id),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.installer_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  installer_id UUID NOT NULL REFERENCES public.users(id),
  order_id UUID UNIQUE NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  scheduled_date TIMESTAMPTZ NOT NULL,
  status job_status NOT NULL DEFAULT 'assigned',
  notes TEXT,
  commission_amount DECIMAL(12,2),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.commission_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  monthly_camera_threshold INTEGER NOT NULL DEFAULT 30,
  per_camera_amount DECIMAL(12,2) NOT NULL DEFAULT 5000,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.commissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dsa_id UUID NOT NULL REFERENCES public.users(id),
  order_id UUID UNIQUE NOT NULL REFERENCES public.orders(id),
  amount DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
  status commission_status NOT NULL DEFAULT 'pending',
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type notification_type NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  related_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  posted_by UUID NOT NULL REFERENCES public.users(id),
  category expense_category NOT NULL DEFAULT 'other',
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.module_settings (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 3. PRONET TRAINING
-- ==========================================
CREATE TABLE IF NOT EXISTS public.training_modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  order_index INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module_id UUID NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  video_url TEXT,
  content TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  order_index INTEGER NOT NULL,
  is_quiz BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('started', 'completed')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS public.quizzes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module_id UUID NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  pass_percentage INTEGER NOT NULL DEFAULT 70 CHECK (pass_percentage BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer_id TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  score_percentage INTEGER NOT NULL CHECK (score_percentage BETWEEN 0 AND 100),
  passed BOOLEAN NOT NULL DEFAULT false,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.training_resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size_mb DECIMAL(8,2) DEFAULT 0,
  pages INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  module_id UUID REFERENCES public.training_modules(id) ON DELETE SET NULL,
  certificate_number TEXT UNIQUE NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pdf_url TEXT
);

-- ==========================================
-- 4. HELPERS, TRIGGERS, WORKFLOW AUTOMATION
-- ==========================================
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_app_role() IN ('admin', 'super_admin'), false)
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_app_role() = 'super_admin', false)
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    row_id := OLD.id;
  ELSE
    row_id := NEW.id;
  END IF;

  INSERT INTO public.audit_logs (actor_user_id, action, entity_type, entity_id, before_data, after_data)
  VALUES (
    public.current_app_user_id(),
    TG_OP,
    TG_TABLE_NAME,
    row_id,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_admins(notification_title TEXT, notification_message TEXT, notification_type notification_type, related UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, related_id)
  SELECT id, notification_title, notification_message, notification_type, related
  FROM public.users
  WHERE status = 'active' AND role IN ('admin', 'super_admin');
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role user_role;
BEGIN
  IF NEW.raw_user_meta_data ->> 'role' IN ('super_admin', 'admin', 'dsa', 'installer', 'reseller') THEN
    requested_role := (NEW.raw_user_meta_data ->> 'role')::user_role;
  ELSE
    requested_role := 'dsa'::user_role;
  END IF;

  INSERT INTO public.users (auth_id, full_name, email, phone, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data ->> 'phone',
    requested_role,
    'active'
  )
  ON CONFLICT (auth_id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role,
    updated_at = NOW();

  PERFORM public.notify_admins(
    'New portal application',
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email) || ' applied as ' || requested_role::text,
    'system',
    NULL
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_order_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_amount)
    VALUES (NEW.id, NEW.product_id, NEW.quantity, NEW.unit_price, NEW.total_amount)
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.payments (order_id, amount, payment_method, reference_code, receipt_number, status)
  VALUES (
    NEW.id,
    NEW.total_amount,
    'bank_transfer',
    'PAY-' || RIGHT(REPLACE(NEW.id::text, '-', ''), 10),
    'RCPT-' || RIGHT(REPLACE(NEW.id::text, '-', ''), 10),
    'pending'
  );

  PERFORM public.notify_admins(
    'New order created',
    NEW.order_number || ' requires payment confirmation.',
    'order',
    NEW.id
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_payment_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_row public.orders%ROWTYPE;
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.confirmed_at := COALESCE(NEW.confirmed_at, NOW());

    UPDATE public.orders
    SET status = CASE WHEN status = 'pending' THEN 'confirmed' ELSE status END,
        payment_confirmed_at = NEW.confirmed_at,
        updated_at = NOW()
    WHERE id = NEW.order_id
    RETURNING * INTO order_row;

    IF order_row.dsa_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, related_id)
      VALUES (order_row.dsa_id, 'Payment confirmed', order_row.order_number || ' is now confirmed.', 'payment', order_row.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_installer_job_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_row public.orders%ROWTYPE;
BEGIN
  SELECT * INTO order_row FROM public.orders WHERE id = NEW.order_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, title, message, type, related_id)
    VALUES (NEW.installer_id, 'New installation job', 'You have been assigned ' || order_row.order_number, 'job', NEW.id);
  END IF;

  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.completed_at := COALESCE(NEW.completed_at, NOW());
    UPDATE public.installer_profiles
    SET total_jobs = total_jobs + 1,
        updated_at = NOW()
    WHERE user_id = NEW.installer_id;

    PERFORM public.notify_admins(
      'Installation completed',
      order_row.order_number || ' is ready for delivery confirmation.',
      'job',
      NEW.id
    );
  END IF;

  IF order_row.dsa_id IS NOT NULL AND TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (user_id, title, message, type, related_id)
    VALUES (order_row.dsa_id, 'Installer status updated', order_row.order_number || ' is now ' || NEW.status::text, 'job', NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_rule public.commission_rules%ROWTYPE;
  commission_amount DECIMAL(12,2);
BEGIN
  IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.delivered_at := COALESCE(NEW.delivered_at, NOW());

    SELECT * INTO active_rule
    FROM public.commission_rules
    WHERE is_active = true
    ORDER BY created_at DESC
    LIMIT 1;

    IF NEW.dsa_id IS NOT NULL THEN
      commission_amount := COALESCE(active_rule.per_camera_amount, 5000) * NEW.quantity;

      INSERT INTO public.commissions (dsa_id, order_id, amount, status)
      VALUES (NEW.dsa_id, NEW.id, commission_amount, 'pending')
      ON CONFLICT (order_id) DO NOTHING;

      INSERT INTO public.notifications (user_id, title, message, type, related_id)
      VALUES (
        NEW.dsa_id,
        'Commission unlocked',
        NEW.order_number || ' was delivered. Commission has been added.',
        'commission',
        NEW.id
      );
    END IF;
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.notify_admins(
      'Order status changed',
      NEW.order_number || ' moved from ' || OLD.status::text || ' to ' || NEW.status::text,
      'order',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'users','installer_profiles','products','leads','orders','payments','installer_jobs',
    'commission_rules','training_modules','lessons','lesson_progress','quizzes','module_settings'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I', table_name, table_name);
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', table_name, table_name);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS trg_order_created ON public.orders;
CREATE TRIGGER trg_order_created
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.handle_order_created();

DROP TRIGGER IF EXISTS trg_payment_confirmed ON public.payments;
CREATE TRIGGER trg_payment_confirmed
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.handle_payment_confirmed();

DROP TRIGGER IF EXISTS trg_installer_job_change ON public.installer_jobs;
CREATE TRIGGER trg_installer_job_change
BEFORE INSERT OR UPDATE ON public.installer_jobs
FOR EACH ROW EXECUTE FUNCTION public.handle_installer_job_change();

DROP TRIGGER IF EXISTS trg_order_status_change ON public.orders;
CREATE TRIGGER trg_order_status_change
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.handle_order_status_change();

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['users','products','leads','orders','payments','installer_jobs','commissions','module_settings']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_audit ON public.%I', table_name, table_name);
    EXECUTE format('CREATE TRIGGER trg_%I_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()', table_name, table_name);
  END LOOP;
END $$;

-- ==========================================
-- 5. INDEXES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_role_status ON public.users(role, status);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON public.orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_dsa ON public.orders(dsa_id);
CREATE INDEX IF NOT EXISTS idx_orders_reseller ON public.orders(reseller_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_installer_jobs_installer_status ON public.installer_jobs(installer_id, status);
CREATE INDEX IF NOT EXISTS idx_installer_profiles_available ON public.installer_profiles(is_available, location);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user ON public.lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON public.quiz_attempts(user_id);

-- ==========================================
-- 6. RLS
-- ==========================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installer_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_or_admin" ON public.users
FOR SELECT USING (id = public.current_app_user_id() OR public.is_admin());

CREATE POLICY "users_admin_manage" ON public.users
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "installer_profiles_read_active" ON public.installer_profiles
FOR SELECT USING (public.is_admin() OR user_id = public.current_app_user_id() OR is_available = true);

CREATE POLICY "installer_profiles_owner_update" ON public.installer_profiles
FOR UPDATE USING (user_id = public.current_app_user_id() OR public.is_admin())
WITH CHECK (user_id = public.current_app_user_id() OR public.is_admin());

CREATE POLICY "products_public_read" ON public.products
FOR SELECT USING (is_active = true OR public.is_admin());

CREATE POLICY "products_admin_manage" ON public.products
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "leads_dsa_or_admin" ON public.leads
FOR ALL USING (dsa_id = public.current_app_user_id() OR public.is_admin())
WITH CHECK (dsa_id = public.current_app_user_id() OR public.is_admin());

CREATE POLICY "orders_role_select" ON public.orders
FOR SELECT USING (
  public.is_admin()
  OR dsa_id = public.current_app_user_id()
  OR reseller_id = public.current_app_user_id()
  OR EXISTS (
    SELECT 1 FROM public.installer_jobs j
    WHERE j.order_id = orders.id AND j.installer_id = public.current_app_user_id()
  )
);

CREATE POLICY "orders_dsa_reseller_insert" ON public.orders
FOR INSERT WITH CHECK (
  public.is_admin()
  OR dsa_id = public.current_app_user_id()
  OR reseller_id = public.current_app_user_id()
);

CREATE POLICY "orders_admin_update" ON public.orders
FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "order_items_role_read" ON public.order_items
FOR SELECT USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND (o.dsa_id = public.current_app_user_id() OR o.reseller_id = public.current_app_user_id())
  )
);

CREATE POLICY "payments_role_read" ON public.payments
FOR SELECT USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = payments.order_id
      AND (o.dsa_id = public.current_app_user_id() OR o.reseller_id = public.current_app_user_id())
  )
);

CREATE POLICY "payments_admin_update" ON public.payments
FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "installer_jobs_role_access" ON public.installer_jobs
FOR SELECT USING (
  public.is_admin()
  OR installer_id = public.current_app_user_id()
  OR EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = installer_jobs.order_id AND o.dsa_id = public.current_app_user_id()
  )
);

CREATE POLICY "installer_jobs_dsa_insert" ON public.installer_jobs
FOR INSERT WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id AND o.dsa_id = public.current_app_user_id()
  )
);

CREATE POLICY "installer_jobs_installer_update" ON public.installer_jobs
FOR UPDATE USING (installer_id = public.current_app_user_id() OR public.is_admin())
WITH CHECK (installer_id = public.current_app_user_id() OR public.is_admin());

CREATE POLICY "commissions_owner_or_admin" ON public.commissions
FOR SELECT USING (dsa_id = public.current_app_user_id() OR public.is_admin());

CREATE POLICY "commission_rules_admin" ON public.commission_rules
FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "notifications_owner" ON public.notifications
FOR SELECT USING (user_id = public.current_app_user_id() OR public.is_admin());

CREATE POLICY "notifications_owner_update" ON public.notifications
FOR UPDATE USING (user_id = public.current_app_user_id()) WITH CHECK (user_id = public.current_app_user_id());

CREATE POLICY "audit_admin_read" ON public.audit_logs
FOR SELECT USING (public.is_admin());

CREATE POLICY "expenses_admin" ON public.expenses
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "settings_super_admin" ON public.module_settings
FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "training_read_active" ON public.training_modules
FOR SELECT USING (is_active = true OR public.is_admin());

CREATE POLICY "lessons_read" ON public.lessons
FOR SELECT USING (
  public.is_admin()
  OR EXISTS (SELECT 1 FROM public.training_modules m WHERE m.id = lessons.module_id AND m.is_active = true)
);

CREATE POLICY "training_admin_manage_modules" ON public.training_modules
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "training_admin_manage_lessons" ON public.lessons
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "lesson_progress_owner" ON public.lesson_progress
FOR ALL USING (user_id = public.current_app_user_id() OR public.is_admin())
WITH CHECK (user_id = public.current_app_user_id() OR public.is_admin());

CREATE POLICY "quizzes_read" ON public.quizzes
FOR SELECT USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.training_modules m WHERE m.id = quizzes.module_id AND m.is_active = true));

CREATE POLICY "quiz_questions_read" ON public.quiz_questions
FOR SELECT USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.quizzes q JOIN public.training_modules m ON m.id = q.module_id WHERE q.id = quiz_questions.quiz_id AND m.is_active = true));

CREATE POLICY "quiz_attempts_owner" ON public.quiz_attempts
FOR ALL USING (user_id = public.current_app_user_id() OR public.is_admin())
WITH CHECK (user_id = public.current_app_user_id() OR public.is_admin());

CREATE POLICY "training_resources_read" ON public.training_resources
FOR SELECT USING (true);

CREATE POLICY "certificates_owner" ON public.certificates
FOR ALL USING (user_id = public.current_app_user_id() OR public.is_admin())
WITH CHECK (user_id = public.current_app_user_id() OR public.is_admin());

-- ==========================================
-- 7. DEFAULT SETTINGS
-- ==========================================
INSERT INTO public.commission_rules (name, monthly_camera_threshold, per_camera_amount, is_active)
VALUES ('Default delivered camera commission', 30, 5000, true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.module_settings (key, enabled, value)
VALUES
('commissions', true, '{"threshold":30}'::jsonb),
('training', true, '{}'::jsonb),
('reseller_bulk_orders', true, '{}'::jsonb),
('installer_booking', true, '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;
