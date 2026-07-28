import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { DEMO_MOCK } from "@/lib/demo/mode";
import { createMockServerClient } from "@/lib/demo/mock-client";

export async function createClient() {
  const cookieStore = await cookies();

  if (DEMO_MOCK) {
    return createMockServerClient(cookieStore) as unknown as SupabaseClient;
  }

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
            // Called from a Server Component render — safe to ignore since
            // the proxy already refreshes the session on every request.
          }
        },
      },
    }
  );
}
