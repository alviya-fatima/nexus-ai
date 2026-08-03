import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://mqfvkeiyaymooszjgozc.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xZnZrZWl5YXltb29zempnb3pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyOTc1NzAsImV4cCI6MjA5OTg3MzU3MH0.tlJI5S3P0uvCnWU7K8SYwQbAOokwN4D_vpVdlSP3bbI";

// Safe to use in both client components and server routes —
// the anon key is designed to be public, access is controlled
// by Row Level Security policies on the Supabase side.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);