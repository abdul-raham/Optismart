-- OptiSmart Portal - Production Seed Data
-- Run after supabase_migration.sql.
-- Create matching Supabase Auth users separately, then connect auth.users.id to public.users.auth_id if needed.

TRUNCATE public.certificates CASCADE;
TRUNCATE public.quiz_attempts CASCADE;
TRUNCATE public.quiz_questions CASCADE;
TRUNCATE public.quizzes CASCADE;
TRUNCATE public.lesson_progress CASCADE;
TRUNCATE public.training_resources CASCADE;
TRUNCATE public.lessons CASCADE;
TRUNCATE public.training_modules CASCADE;
TRUNCATE public.module_settings CASCADE;
TRUNCATE public.audit_logs CASCADE;
TRUNCATE public.notifications CASCADE;
TRUNCATE public.commissions CASCADE;
TRUNCATE public.commission_rules CASCADE;
TRUNCATE public.installer_jobs CASCADE;
TRUNCATE public.payments CASCADE;
TRUNCATE public.order_items CASCADE;
TRUNCATE public.orders CASCADE;
TRUNCATE public.leads CASCADE;
TRUNCATE public.installer_profiles CASCADE;
TRUNCATE public.products CASCADE;
TRUNCATE public.users CASCADE;

INSERT INTO public.users (id, full_name, email, phone, role, status)
VALUES
('11111111-1111-1111-1111-111111111111', 'OptiSmart Super Admin', 'owner@optismart.ng', '+2348000000000', 'super_admin', 'active'),
('22222222-2222-2222-2222-222222222222', 'OptiSmart Admin', 'admin@optismart.ng', '+2348000000001', 'admin', 'active'),
('33333333-3333-3333-3333-333333333333', 'Amina Sales', 'dsa@optismart.ng', '+2348011111111', 'dsa', 'active'),
('44444444-4444-4444-4444-444444444444', 'Tunde Installer', 'installer@optismart.ng', '+2348022222222', 'installer', 'active'),
('55555555-5555-5555-5555-555555555555', 'Kemi Reseller', 'reseller@optismart.ng', '+2348033333333', 'reseller', 'active');

INSERT INTO public.installer_profiles (user_id, location, is_available, rating, total_jobs)
VALUES
('44444444-4444-4444-4444-444444444444', 'Lagos', true, 4.80, 36);

INSERT INTO public.commission_rules (id, name, monthly_camera_threshold, per_camera_amount, is_active)
VALUES
('10101010-1010-1010-1010-101010101010', 'Default delivered camera commission', 30, 5000, true);

INSERT INTO public.module_settings (key, enabled, value)
VALUES
('commissions', true, '{"threshold":30,"per_camera_amount":5000}'::jsonb),
('training', true, '{}'::jsonb),
('reseller_bulk_orders', true, '{}'::jsonb),
('installer_booking', true, '{}'::jsonb);

INSERT INTO public.products
(id, name, description, retail_price, wholesale_price, stock_quantity, min_stock_level, image_url, source_url, is_active)
VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Smart Indoor CCTV Camera', '3MP HD IP indoor camera with wide-angle coverage, 355-degree pan, 90-degree tilt, and remote monitoring for homes and offices.', 45000, 39000, 30, 8, '/products/wifi_indoor_3mp.jpg', 'https://optismart.com.ng/smart-indoor-cctv-camera/', true),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '4G Solar PTZ Camera', 'Solar-powered 4G PTZ surveillance camera built for round-the-clock outdoor monitoring with infrared night vision.', 185000, 165000, 18, 5, '/products/solar_ptz_ext.jpg', 'https://optismart.com.ng/4g-solar-ptz-camera/', true),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Dual Lens Bulb CCTV Camera', 'Bulb-style CCTV camera with dual-lens wide-angle coverage, HD video quality, and 360-degree indoor/outdoor monitoring.', 38000, 32000, 40, 10, '/products/bulb_dual_lens.jpg', 'https://optismart.com.ng/product/dual-lens-bulb-cctv-camera/', true),
('dddddddd-dddd-dddd-dddd-dddddddddddd', '4G Bulb Indoor CCTV Camera', 'Indoor bulb CCTV camera with 4G connectivity, panoramic 360-degree coverage, HD video, and motion alerts for non-Wi-Fi locations.', 52000, 45000, 24, 8, '/products/bulb_4g_indoor.jpg', 'https://optismart.com.ng/product/4g-bulb-indoor-cctv-camera/', true),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Indoor 4G Dual Lens CCTV Camera', 'Indoor 4G dual-lens CCTV camera with 1080p HD video quality, motion detection alerts, and infrared night vision.', 75000, 65000, 20, 6, '/products/desktop_4g_dual.jpg', 'https://optismart.com.ng/product/indoor-4g-dual-lenz-cctv-camera/', true),
('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Mini CCTV Camera', 'Compact mini CCTV camera with a 150-degree ultra-wide-angle lens for discreet room coverage and reduced blind spots.', 30000, 25000, 35, 10, '/products/wifi_indoor_3mp.jpg', 'https://optismart.com.ng/mini-cctv-camera/', true);

INSERT INTO public.leads (id, dsa_id, customer_name, phone, email, location, status, temperature, notes, follow_up_date)
VALUES
('12121212-1212-1212-1212-121212121212', '33333333-3333-3333-3333-333333333333', 'Adeola Bankole', '+2348011111111', 'adeola@example.com', 'Ikeja, Lagos', 'new', 'warm', 'Interested in indoor CCTV for a small office.', NOW() + INTERVAL '2 days'),
('23232323-2323-2323-2323-232323232323', '33333333-3333-3333-3333-333333333333', 'Chukwudi Obi', '+2348033333333', 'obi@example.com', 'Wuse, Abuja', 'contacted', 'hot', 'Needs outdoor solar PTZ for a warehouse.', NOW() + INTERVAL '1 day');

INSERT INTO public.orders
(id, order_number, dsa_id, customer_name, customer_phone, customer_address, product_id, quantity, unit_price, total_amount, status, notes)
VALUES
('99999999-9999-9999-9999-999999999999', 'OPT-20260622-001', '33333333-3333-3333-3333-333333333333', 'Adeola Bankole', '+2348011111111', '12 Awolowo Road, Ikeja, Lagos', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2, 45000, 90000, 'pending', 'Customer requested installation this week.'),
('88888888-8888-8888-8888-888888888888', 'OPT-20260622-002', '33333333-3333-3333-3333-333333333333', 'Chukwudi Obi', '+2348033333333', '20 Aminu Kano Crescent, Wuse, Abuja', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1, 185000, 185000, 'dispatched', 'Warehouse perimeter camera.');

INSERT INTO public.installer_jobs (installer_id, order_id, scheduled_date, status, commission_amount)
VALUES
('44444444-4444-4444-4444-444444444444', '99999999-9999-9999-9999-999999999999', NOW() + INTERVAL '2 days', 'assigned', 15000),
('44444444-4444-4444-4444-444444444444', '88888888-8888-8888-8888-888888888888', NOW() - INTERVAL '1 day', 'completed', 15000);

UPDATE public.payments
SET status = 'confirmed',
    confirmed_by = '22222222-2222-2222-2222-222222222222',
    confirmed_at = NOW()
WHERE order_id = '88888888-8888-8888-8888-888888888888';

UPDATE public.orders
SET status = 'delivered'
WHERE id = '88888888-8888-8888-8888-888888888888';

INSERT INTO public.training_modules (id, title, description, duration_minutes, order_index, is_active)
VALUES
('61616161-6161-6161-6161-616161616161', 'CCTV Installation Basics', 'Core hardware, placement, power, and setup standards for OptiSmart installers.', 45, 1, true),
('72727272-7272-7272-7272-727272727272', 'Selling Smart CCTV Solutions', 'DSA sales playbook for qualifying customers and packaging OptiSmart devices.', 35, 2, true);

INSERT INTO public.lessons (id, module_id, title, video_url, content, duration_minutes, order_index, is_quiz)
VALUES
('abababab-abab-abab-abab-abababababab', '61616161-6161-6161-6161-616161616161', 'Camera placement and blind spots', NULL, 'Choose camera positions that reduce blind spots and improve coverage.', 15, 1, false),
('bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbcbc', '61616161-6161-6161-6161-616161616161', 'Installation safety checklist', NULL, 'A field-ready checklist for safe, clean installation.', 20, 2, false),
('cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd', '72727272-7272-7272-7272-727272727272', 'Lead qualification script', NULL, 'Ask the right questions before recommending indoor, bulb, 4G, or solar PTZ devices.', 12, 1, false);

INSERT INTO public.quizzes (id, module_id, title, pass_percentage)
VALUES
('dededede-dede-dede-dede-dededededede', '61616161-6161-6161-6161-616161616161', 'Installation Basics Assessment', 70);

INSERT INTO public.quiz_questions (quiz_id, text, options, correct_answer_id, order_index)
VALUES
('dededede-dede-dede-dede-dededededede', 'What counts as a completed sale for DSA commission?', '[{"id":"a","text":"Any pending order"},{"id":"b","text":"Only delivered orders"},{"id":"c","text":"Any lead created"}]'::jsonb, 'b', 1),
('dededede-dede-dede-dede-dededededede', 'Who confirms final delivery in the portal?', '[{"id":"a","text":"Admin"},{"id":"b","text":"Customer only"},{"id":"c","text":"Any reseller"}]'::jsonb, 'a', 2);

INSERT INTO public.training_resources (title, category, file_url, file_size_mb, pages)
VALUES
('CCTV Installation Checklist', 'Checklist', 'https://optismart.com.ng/', 1.20, 4),
('DSA Sales Qualification Guide', 'Guide', 'https://optismart.com.ng/', 0.80, 6);
