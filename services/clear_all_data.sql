-- SQL Script to Clear All System Data
-- Preserves Users, but deletes all operational data.

-- 1. Clear Incidents
DELETE FROM public.incidents;

-- 2. Clear Sheets (Operational Data)
DELETE FROM public.sheets;

-- 3. Clear Logs (Audit Trail)
DELETE FROM public.logs;

-- Note: Users table (public.users) is NOT cleared to prevent lockout.
