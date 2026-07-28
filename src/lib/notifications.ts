import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationType } from "@/lib/types";

/**
 * Creates in-app notifications for sellers. Always writes via the service-role
 * client (bypasses RLS). Failures are logged, never thrown, so notifying can't
 * break the action that triggered it.
 */
export async function notify(
  userId: string,
  message: string,
  opts: { type?: NotificationType; leadId?: string | null } = {}
) {
  try {
    const supabase = createAdminClient();
    await supabase.from("notifications").insert({
      user_id: userId,
      type: opts.type ?? "lead_assigned",
      message,
      lead_id: opts.leadId ?? null,
    });
  } catch (error) {
    console.error("[notify]", error);
  }
}
