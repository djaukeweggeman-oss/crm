import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export const supabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

// Bewaar de login alleen in het huidige browsertabblad. Hierdoor blijven
// toegangstokens niet langdurig achter op een gedeelde of gestolen computer.
const sessionStorageAdapter = {
  getItem: (key: string) =>
    typeof window === "undefined" ? null : window.sessionStorage.getItem(key),
  setItem: (key: string, value: string) => {
    if (typeof window !== "undefined") window.sessionStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (typeof window !== "undefined") window.sessionStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl || "https://example.supabase.co", supabasePublishableKey || "not-configured", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: sessionStorageAdapter,
    storageKey: "nfc-administratie-auth",
  },
});
