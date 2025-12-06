
-- Enable Row Level Security (good practice, though we will allow all for this free tier setup)
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;

-- 1. USERS TABLE
create table if not exists users (
  id text primary key,
  data jsonb not null
);
-- Allow public access (read/write) for 'free tier' usage without auth
alter table users enable row level security;
drop policy if exists "Allow Public Access" on users;
create policy "Allow Public Access" on users for all using (true) with check (true);

-- 2. SHEETS TABLE
create table if not exists sheets (
  id text primary key,
  data jsonb not null,
  created_at timestamptz default now()
);
alter table sheets enable row level security;
drop policy if exists "Allow Public Access" on sheets;
create policy "Allow Public Access" on sheets for all using (true) with check (true);

-- 3. LOGS TABLE
create table if not exists logs (
  id text primary key,
  data jsonb not null
);
alter table logs enable row level security;
drop policy if exists "Allow Public Access" on logs;
create policy "Allow Public Access" on logs for all using (true) with check (true);
