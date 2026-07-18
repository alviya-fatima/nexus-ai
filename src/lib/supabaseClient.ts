import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Safe to use in both client components and server routes —
// the anon key is designed to be public, access is controlled
// by Row Level Security policies on the Supabase side.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);