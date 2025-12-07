-- ========================================================
-- RUN THIS IN YOUR SUPABASE SQL EDITOR TO FIX PERMISSIONS
-- ========================================================

-- DEFINITION: "Public Access" here means strictly for the application to function 
-- without needing Supabase's built-in Auth (since we handle Auth in the app logic layer).

-- 1. USERS TABLE
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.users;
CREATE POLICY "Enable all access for all users" ON public.users
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 2. SHEETS TABLE
ALTER TABLE IF EXISTS public.sheets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.sheets;
CREATE POLICY "Enable all access for all users" ON public.sheets
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 3. LOGS TABLE
ALTER TABLE IF EXISTS public.logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.logs;
CREATE POLICY "Enable all access for all users" ON public.logs
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 4. GRANT PERMISSIONS (Just in case)
GRANT ALL ON TABLE public.users TO anon;
GRANT ALL ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role;

GRANT ALL ON TABLE public.sheets TO anon;
GRANT ALL ON TABLE public.sheets TO authenticated;
GRANT ALL ON TABLE public.sheets TO service_role;

GRANT ALL ON TABLE public.logs TO anon;
GRANT ALL ON TABLE public.logs TO authenticated;
GRANT ALL ON TABLE public.logs TO service_role;
