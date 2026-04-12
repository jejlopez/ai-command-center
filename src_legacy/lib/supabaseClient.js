import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const missingSupabaseEnv = [];

if (!supabaseUrl) missingSupabaseEnv.push('VITE_SUPABASE_URL');
if (!supabaseAnonKey) missingSupabaseEnv.push('VITE_SUPABASE_ANON_KEY');

export const supabaseConfigError = missingSupabaseEnv.length
  ? `Missing Supabase configuration: ${missingSupabaseEnv.join(', ')}. Add them to your local .env file and restart Vite.`
  : null;

if (supabaseConfigError) {
  console.warn(`[Jarvis] ${supabaseConfigError}`);
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);
