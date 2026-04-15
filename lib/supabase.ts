import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://bxuzbfrbydsiggbljbow.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4dXpiZnJieWRzaWdnYmxqYm93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNTMyNjgsImV4cCI6MjA5MTgyOTI2OH0.0-2JzU7cmUNyn52lOI9OLRSqz-FlBuMObN5T9Bdqtxs";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);