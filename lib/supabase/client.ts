import { createBrowserClient } from "@supabase/ssr";

// Used in Client Components. Relies on the anon key, safe to expose to the browser —
// RLS policies in supabase/schema.sql are what actually keep data private.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
