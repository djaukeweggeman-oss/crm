import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export const supabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);
export const supabase = createClient(supabaseUrl || "https://example.supabase.co", supabasePublishableKey || "not-configured", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

