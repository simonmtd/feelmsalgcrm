import { requireProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { applyTodoFilter, callQueue } from "@/lib/lead-filters";
import { CallMode, type CallActivity } from "@/components/call-mode/call-mode";
import type { Lead } from "@/lib/types";

/**
 * Ringemodus. Builds today's call queue from the seller's own leads (optionally
 * narrowed by the same "Å gjøre" filter as Mine leads), and can start from a
 * specific lead (?start=<id>), e.g. «Ring herfra».
 */
export default async function CallModePage({
  searchParams,
}: {
  searchParams: Promise<{ todo?: string; start?: string; from?: string }>;
}) {
  const profile = await requireProfile();
  const { todo, start, from } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("leads")
    .select("*, niche:niches(*)")
    .eq("assigned_to", profile.id);
  const mine = (data as Lead[] | null) ?? [];

  let queue = callQueue(await applyTodoFilter(supabase, profile.id, mine, todo));
  if (start) {
    const at = queue.findIndex((l) => l.id === start);
    if (at > 0) queue = [...queue.slice(at), ...queue.slice(0, at)];
    else if (at === -1) {
      const lead = mine.find((l) => l.id === start && l.phone);
      if (lead) queue = [lead, ...queue];
    }
  }

  // The last few notes/calls per lead, so the seller knows what was said before.
  const activities: Record<string, CallActivity[]> = {};
  if (queue.length) {
    const { data: acts } = await supabase
      .from("lead_activities")
      .select("lead_id, content, type, created_at")
      .in("lead_id", queue.map((l) => l.id))
      .in("type", ["note", "call"])
      .order("created_at", { ascending: false });
    for (const a of (acts as (CallActivity & { lead_id: string })[] | null) ?? []) {
      const list = (activities[a.lead_id] ??= []);
      if (list.length < 3) list.push({ content: a.content, type: a.type, created_at: a.created_at });
    }
  }

  const backHref = from === "today" ? "/today" : todo ? `/leads?todo=${encodeURIComponent(todo)}` : "/leads";
  return <CallMode queue={queue} activities={activities} backHref={backHref} />;
}
