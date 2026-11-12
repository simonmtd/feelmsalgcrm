import "server-only";
import type { Lead } from "@/lib/types";
import { hasCallablePhone } from "@/lib/utils";

export type TodoFilter = "uncontacted" | "overdue" | "stale" | "no_answer";

const OPEN = ["new", "assigned", "contacted", "follow_up"];

/**
 * The "Å gjøre" filters on a seller's leads (so nothing falls between the
 * chairs). Shared by Mine leads and the call mode queue so both mean the same.
 */
export function applyTodoFilter(leads: Lead[], todo: string | undefined): Lead[] {
  if (todo === "uncontacted") {
    // Never called: still new/assigned and no registered call on the lead.
    return leads.filter((l) => (l.status === "new" || l.status === "assigned") && !l.last_call_at);
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
    // Leads to ring back: the latest call on the lead (by anyone – so leads
    // handed over from another seller come along) was "ikke svar", still open.
    return leads.filter((l) => l.last_call_outcome === "no_answer" && l.status !== "won" && l.status !== "lost");
  }
  return leads;
}

/**
 * Call-queue order: overdue follow-ups first (oldest first), then never-called
 * leads (oldest assignment first). Only open leads with a phone number; a lead
 * with a follow-up joins the queue once that time has come.
 */
export function callQueue(leads: Lead[]): Lead[] {
  const now = new Date().getTime();

  const rank = (l: Lead): [number, number] => {
    const fu = l.next_follow_up_at ? new Date(l.next_follow_up_at).getTime() : null;
    if (fu != null && fu < now) return [0, fu];
    if (l.status === "new" || l.status === "assigned") {
      return [1, new Date(l.assigned_date ?? l.created_at).getTime()];
    }
    return [2, fu ?? new Date(l.updated_at).getTime()];
  };

  return leads
    .filter((l) => OPEN.includes(l.status) && hasCallablePhone(l.phone))
    // A follow-up set for a time (e.g. «ring etter kl. 14») only joins the queue once it's due.
    .filter((l) => !l.next_follow_up_at || new Date(l.next_follow_up_at).getTime() <= now)
    .sort((a, b) => {
      const [ra, ta] = rank(a);
      const [rb, tb] = rank(b);
      return ra - rb || ta - tb;
    });
}
