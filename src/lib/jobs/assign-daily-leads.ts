import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications";
import { loadCalledCompanies } from "@/lib/lead-dedup-index";
import { normCompany } from "@/lib/dedup";
import { hasCallablePhone } from "@/lib/utils";

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
 *
 * Only hands out leads that can actually be called: a dialable phone number,
 * not a merged duplicate, and not at a company the team has already called.
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
  const calledCompanies = sellers?.length ? await loadCalledCompanies(supabase) : new Set<string>();

  for (const seller of sellers ?? []) {
    // Over-fetch: many pool leads have a junk/missing number or a called company.
    const { data: candidateLeads } = await supabase
      .from("leads")
      .select("id, phone, company_name")
      .eq("niche_id", seller.active_niche_id)
      .is("assigned_to", null)
      .eq("status", "new")
      .is("duplicate_of", null)
      .not("phone", "is", null)
      .order("created_at")
      .limit(1000);

    const ids = ((candidateLeads as { id: string; phone: string | null; company_name: string | null }[] | null) ?? [])
      .filter((l) => hasCallablePhone(l.phone))
      .filter((l) => {
        const c = normCompany(l.company_name);
        return !c || !calledCompanies.has(c);
      })
      .slice(0, dailyLeadCount)
      .map((l) => l.id);

    if (!ids.length) continue;
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
