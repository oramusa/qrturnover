import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Used in Server Components, Server Actions, and Route Handlers.
// Reads/writes the auth cookie so the logged-in host's session carries over.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component that can't set cookies — safe to ignore
            // as long as middleware.ts is refreshing the session.
          }
        },
      },
    }
  );
}

// Admin client — service role key, server-only, bypasses RLS.
// Used ONLY for the public /api/scan route, since cleaners never log in
// and therefore have no auth.uid() for RLS to check against.
import { createClient as createAdminClient } from "@supabase/supabase-js";

export function createServiceRoleClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
