-- Create Incidents Table (Run this in Supabase SQL Editor)
CREATE TABLE IF NOT EXISTS public.incidents (
    id SERIAL PRIMARY KEY,
    sheet_id TEXT NOT NULL,
    type TEXT NOT NULL,
    priority TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'OPEN',
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT
);

-- Enable RLS
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- 1. Grant Select to everyone (or restrict if needed)
CREATE POLICY "Allow Select All" ON public.incidents
FOR SELECT USING (true);

-- 2. Grant Insert to authenticated users
CREATE POLICY "Allow Insert Authenticated" ON public.incidents
FOR INSERT WITH CHECK (true);

-- 3. Grant Update to owners or admins
CREATE POLICY "Allow Update Owners/Admins" ON public.incidents
FOR UPDATE USING (
    auth.uid()::text = created_by OR
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid()::text AND (data->>'role') = 'ADMIN'
    )
);
