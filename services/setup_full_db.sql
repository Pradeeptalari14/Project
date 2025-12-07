-- ================================================================
-- MASTER SETUP SCRIPT: TABLES + PERMISSIONS + SEED DATA
-- Run this ENTIRE file in Supabase SQL Editor to fully initialize
-- the database for the Unicharm Operations App.
-- ================================================================

-- 1. CLEANUP (Optional - remove if you want to preserve data)
-- DROP TABLE IF EXISTS public.users;
-- DROP TABLE IF EXISTS public.sheets;
-- DROP TABLE IF EXISTS public.logs;
-- DROP TABLE IF EXISTS public.incidents;

-- 2. CREATE TABLES
CREATE TABLE IF NOT EXISTS public.users (
  id text PRIMARY KEY,
  data jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS public.sheets (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.logs (
  id text PRIMARY KEY,
  data jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS public.incidents (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 3. ENABLE RLS & SET PERMISSIONS
-- We manage Auth in the app layer, so we enable full access for the API roles.

-- Users Table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access" ON public.users;
CREATE POLICY "Public Access" ON public.users FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.users TO anon, authenticated, service_role;

-- Sheets Table
ALTER TABLE public.sheets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access" ON public.sheets;
CREATE POLICY "Public Access" ON public.sheets FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.sheets TO anon, authenticated, service_role;

-- Logs Table
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access" ON public.logs;
CREATE POLICY "Public Access" ON public.logs FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.logs TO anon, authenticated, service_role;

-- Incidents Table
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access" ON public.incidents;
CREATE POLICY "Public Access" ON public.incidents FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.incidents TO anon, authenticated, service_role;

-- 4. SEED DATA (Default Admin)
INSERT INTO public.users (id, data)
VALUES (
  '1',
  '{
    "id": "1",
    "username": "admin",
    "password": "123",
    "role": "ADMIN",
    "fullName": "System Administrator",
    "empCode": "ADM001",
    "isApproved": true,
    "email": "admin@unicharm.com"
  }'::jsonb
)
ON CONFLICT (id) DO NOTHING;
