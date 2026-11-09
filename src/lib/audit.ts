import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/types";

interface AuditOptions {
  targetType?: string;
  targetId?: string | null;
  details?: Record<string, unknown>;
}

/**
 * Records an admin action in the audit log. Always writes via the service-role
 * client so entries can't be forged or blocked by RLS. Failures are swallowed
 * (logged only) so auditing can never break the underlying action.
 */
export async function logAudit(
  /** id is null for non-user actors, e.g. an admin API key. */
  actor: { id: Profile["id"] | null; email: Profile["email"] },
  action: string,
  opts: AuditOptions = {}
) {
  try {
    const supabase = createAdminClient();
    await supabase.from("audit_log").insert({
      actor_id: actor.id,
      actor_email: actor.email,
      action,
      target_type: opts.targetType ?? null,
      target_id: opts.targetId ?? null,
      details: opts.details ?? null,
    });
  } catch (error) {
    console.error("[logAudit]", error);
  }
}
