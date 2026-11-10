import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { Lead } from "@/lib/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type TodoFilter = "uncontacted" | "overdue" | "stale" | "no_answer";

const OPEN = ["new", "assigned", "contacted", "follow_up"];

/**
 * The "Å gjøre" filters on a seller's leads (so nothing falls between the
 * chairs). Shared by Mine leads and the call mode queue so both mean the same.
 */
export async function applyTodoFilter(
  supabase: Supabase,
  sellerId: string,
  leads: Lead[],
  todo: string | undefined
): Promise<Lead[]> {
  if (todo === "uncontacted") {
    return leads.filter((l) => l.status === "new" || l.status === "assigned");
  }
  if (todo === "overdue") {
    const now = Date.now();
    return leads.filter(
      (l) => OPEN.includes(l.status) && l.next_follow_up_at != null && new Date(l.next_follow_up_at).getTime() <= now
    );
  }
  if (todo === "stale") {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 3);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return leads.filter(
      (l) => (l.status === "new" || l.status === "assigned") && l.assigned_date != null && l.assigned_date <= cutoffStr
    );
  }
  if (todo === "no_answer") {
    // Leads to ring back: the most recent registered call was "ikke svar" and
    // the lead is still open. Latest outcome wins, so a later successful call
    // takes it off the list.
    const { data: calls } = await supabase
      .from("call_logs")
      .select("lead_id, outcome, created_at")
      .eq("seller_id", sellerId)
      .not("lead_id", "is", null)
      .order("created_at", { ascending: false });
    const latestOutcome = new Map<string, string | null>();
    for (const c of (calls as { lead_id: string | null; outcome: string | null }[] | null) ?? []) {
      if (c.lead_id && !latestOutcome.has(c.lead_id)) latestOutcome.set(c.lead_id, c.outcome);
    }
    return leads.filter((l) => latestOutcome.get(l.id) === "no_answer" && l.status !== "won" && l.status !== "lost");
  }
  return leads;
}

/**
 * Call-queue order: overdue follow-ups first (oldest first), then never-called
 * leads (oldest assignment first), then follow-ups due today. Only open leads
 * with a phone number; follow-ups scheduled after today are left alone.
 */
export function callQueue(leads: Lead[]): Lead[] {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const now = Date.now();

  const rank = (l: Lead): [number, number] => {
    const fu = l.next_follow_up_at ? new Date(l.next_follow_up_at).getTime() : null;
    if (fu != null && fu < now) return [0, fu];
    if (l.status === "new" || l.status === "assigned") {
      return [1, new Date(l.assigned_date ?? l.created_at).getTime()];
    }
    return [2, fu ?? new Date(l.updated_at).getTime()];
  };

  return leads
    .filter((l) => OPEN.includes(l.status) && !!l.phone)
    .filter((l) => !l.next_follow_up_at || new Date(l.next_follow_up_at).getTime() <= endOfToday.getTime())
    .sort((a, b) => {
      const [ra, ta] = rank(a);
      const [rb, tb] = rank(b);
      return ra - rb || ta - tb;
    });
}
