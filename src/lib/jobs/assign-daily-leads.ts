import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications";

export interface AssignmentResult {
  ok: boolean;
  assignments: Record<string, number>;
}

const DEFAULT_DAILY_LEAD_COUNT = 10;

/**
 * For every active seller with a selected niche, assigns up to
 * `daily_lead_count` unassigned leads from that niche. Runs sellers
 * sequentially so each seller's UPDATE (guarded by `assigned_to is null`)
 * commits before the next seller's SELECT runs, avoiding double-assignment
 * when two sellers share a niche.
 */
export async function runDailyAssignment(): Promise<AssignmentResult> {
  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: settings } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "daily_lead_count")
    .maybeSingle();
  const dailyLeadCount = Number(settings?.value ?? DEFAULT_DAILY_LEAD_COUNT);

  const { data: sellers } = await supabase
    .from("profiles")
    .select("id, active_niche_id")
    .eq("role", "seller")
    .eq("is_active", true)
    .not("active_niche_id", "is", null);

  const assignments: Record<string, number> = {};

  for (const seller of sellers ?? []) {
    const { data: candidateLeads } = await supabase
      .from("leads")
      .select("id")
      .eq("niche_id", seller.active_niche_id)
      .is("assigned_to", null)
      .eq("status", "new")
      .limit(dailyLeadCount);

    if (!candidateLeads?.length) continue;

    const ids = candidateLeads.map((lead) => lead.id);
    const { data: updated } = await supabase
      .from("leads")
      .update({ assigned_to: seller.id, status: "assigned", assigned_date: today })
      .in("id", ids)
      .is("assigned_to", null)
      .select("id");

    const count = updated?.length ?? 0;
    assignments[seller.id] = count;
    if (count > 0) {
      await notify(seller.id, `Du har fått ${count} ${count === 1 ? "ny lead" : "nye leads"} tildelt i dag.`);
    }
  }

  return { ok: true, assignments };
}
