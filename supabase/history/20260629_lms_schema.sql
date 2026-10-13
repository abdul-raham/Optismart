-- LMS Schema Definition

CREATE TABLE IF NOT EXISTS public.lms_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  required_tier TEXT DEFAULT 'tier1',
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lms_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lms_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES public.lms_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  duration TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lms_user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.lms_lessons(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'completed',
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

-- RLS Policies
ALTER TABLE public.lms_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_user_progress ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins full access to courses" ON public.lms_courses FOR ALL USING (public.is_admin());
CREATE POLICY "Admins full access to modules" ON public.lms_modules FOR ALL USING (public.is_admin());
CREATE POLICY "Admins full access to lessons" ON public.lms_lessons FOR ALL USING (public.is_admin());
CREATE POLICY "Admins full access to progress" ON public.lms_user_progress FOR ALL USING (public.is_admin());

-- Users can select published courses
CREATE POLICY "Users can view published courses" ON public.lms_courses FOR SELECT USING (is_published = true OR public.is_admin());
CREATE POLICY "Users can view modules of published courses" ON public.lms_modules FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.lms_courses WHERE id = lms_modules.course_id AND is_published = true) OR public.is_admin()
);
CREATE POLICY "Users can view lessons of published courses" ON public.lms_lessons FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.lms_modules 
    JOIN public.lms_courses ON lms_courses.id = lms_modules.course_id 
    WHERE lms_modules.id = lms_lessons.module_id AND is_published = true
  ) OR public.is_admin()
);

-- Users can view and insert their own progress
CREATE POLICY "Users view own progress" ON public.lms_user_progress FOR SELECT USING (user_id = public.current_app_user_id());
CREATE POLICY "Users manage own progress" ON public.lms_user_progress FOR ALL USING (user_id = public.current_app_user_id());
