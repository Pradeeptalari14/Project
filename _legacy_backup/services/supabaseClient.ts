
import { createClient } from '@supabase/supabase-js';
// import { Database } from '../types_db';

// For now, we will use 'any' for the generic to avoid compilation errors until we generate types
// In a real workflow, you'd run `supabase gen types typescript`
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Missing Supabase URL or Key. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
