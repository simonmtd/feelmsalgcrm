import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEMO_MOCK } from "@/lib/demo/mode";
import { createMockAdminClient } from "@/lib/demo/mock-client";

/**
 * Service-role client that bypasses RLS. Only use in trusted server contexts
 * (cron routes, admin server actions) after the caller's role has already
 * been verified.
 */
export function createAdminClient(): SupabaseClient {
  if (DEMO_MOCK) {
    return createMockAdminClient() as unknown as SupabaseClient;
  }

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
