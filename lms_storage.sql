-- Insert Storage Bucket for LMS Videos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('lms-videos', 'lms-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for LMS Videos
CREATE POLICY "Public Access for LMS Videos"
ON storage.objects FOR SELECT
USING ( bucket_id = 'lms-videos' );

CREATE POLICY "Admins can insert LMS Videos"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'lms-videos' AND public.is_admin() );

CREATE POLICY "Admins can update LMS Videos"
ON storage.objects FOR UPDATE
WITH CHECK ( bucket_id = 'lms-videos' AND public.is_admin() );

CREATE POLICY "Admins can delete LMS Videos"
ON storage.objects FOR DELETE
USING ( bucket_id = 'lms-videos' AND public.is_admin() );
