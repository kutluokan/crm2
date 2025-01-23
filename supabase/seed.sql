-- Insert users into auth.users
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'christina.customer@example.com', '$2a$10$abcdefghijklmnopqrstuvwxyzABCDEF', NOW(), '{"role":"customer", "full_name":"Christina Customer"}'::jsonb),
  ('00000000-0000-0000-0000-000000000002', 'adam.admin@example.com', '$2a$10$abcdefghijklmnopqrstuvwxyzABCDEF', NOW(), '{"role":"admin", "full_name":"Adam Admin"}'::jsonb),
  ('00000000-0000-0000-0000-000000000003', 'sarah.support@example.com', '$2a$10$abcdefghijklmnopqrstuvwxyzABCDEF', NOW(), '{"role":"support", "full_name":"Sarah Support"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Insert corresponding profiles
INSERT INTO public.profiles (id, role, full_name, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'customer', 'Christina Customer', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000002', 'admin', 'Adam Admin', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000003', 'support', 'Sarah Support', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Set their passwords (password is 'password123' for all users)
UPDATE auth.users
SET encrypted_password = crypt('password123', gen_salt('bf'))
WHERE email IN (
  'christina.customer@example.com',
  'adam.admin@example.com',
  'sarah.support@example.com'
); 