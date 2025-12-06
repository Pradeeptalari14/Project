# Deployment Guide

## 1. Supabase Setup (Backend)

1.  **Create Project**: Go to [Supabase](https://supabase.com) and create a new project.
2.  **Database Setup**:
    - Go to the **SQL Editor** in your Supabase Dashboard.
    - Run the contents of `services/schema.sql` to create the tables.
    - Run the contents of `services/seed_data.sql` to create the default Admin.
3.  **Get Credentials**:
    - Go to **Project Settings** -> **API**.
    - Copy the `Project URL` and `anon public` key.

## 2. Vercel Deployment (Frontend)

1.  **Create Project**: Import this repository into Vercel.
2.  **Environment Variables**:
    - In Vercel Project Settings, add the following variables:
      - `VITE_SUPABASE_URL`: (Your Project URL)
      - `VITE_SUPABASE_ANON_KEY`: (Your Anon Key)
3.  **Deploy**: Vercel will automatically detect the Vite build settings.
    - Build Command: `npm run build`
    - Output Directory: `dist`

## 3. Important Notes

- **Users**: The default admin is User: `admin`, Pass: `123`. Change this immediately after first login if this is real production data (update using the "My Profile" or similar logic if implemented, or directly in DB).
- **Security**: This project uses a simplified "Allow All" RLS policy for the demo `users` table as requested. For a real production app, stricter RLS policies differ based on 'auth.uid()'.
- **Browser Navigation**: `vercel.json` is included to handle SPA routing (rewrites 404s to index.html).
