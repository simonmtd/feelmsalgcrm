import { requireProfile } from "@/lib/dal";
import { fetchAll } from "@/lib/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { applyTodoFilter, callQueue } from "@/lib/lead-filters";
import { CallMode, type CallActivity, type CallModeChoice } from "@/components/call-mode/call-mode";
import { hasCallablePhone } from "@/lib/utils";
import type { Lead } from "@/lib/types";

/** The queues a seller can pick between at the top of call mode. */
const MODES: { key: string | null; label: string }[] = [
  { key: null, label: "Alle som skal ringes" },
  { key: "uncontacted", label: "Kun ikke kontaktet" },
  { key: "no_answer", label: "Ikke svar" },
  { key: "overdue", label: "Forfalt oppfølging" },
  { key: "stale", label: "Glemt (3+ dager)" },
];

/**
 * Ringemodus. Builds today's call queue from the seller's own leads (optionally
 * narrowed by the same "Å gjøre" filter as Mine leads), and can start from a
 * specific lead (?start=<id>), e.g. «Ring herfra». The seller picks which
 * queue to work at the top (all / only never-contacted / no answer / overdue);
 * every queue only holds leads with a dialable phone number.
 */
export default async function CallModePage({
  searchParams,
}: {
  searchParams: Promise<{ todo?: string; start?: string; from?: string }>;
}) {
  const profile = await requireProfile();
  const { todo, start, from } = await searchParams;
  const supabase = await createClient();

  const mine = await fetchAll<Lead>((from, to) =>
    supabase.from("leads").select("*, niche:niches(*)").eq("assigned_to", profile.id).order("id").range(from, to)
  );

  const mode = MODES.some((m) => m.key === todo) ? todo : undefined;
  const queues = await Promise.all(
    MODES.map(async (m) => callQueue(await applyTodoFilter(supabase, profile.id, mine, m.key ?? undefined)))
  );
  let queue = queues[MODES.findIndex((m) => m.key === (mode ?? null))];
  const choices: CallModeChoice[] = MODES.map((m, i) => {
    const qs = new URLSearchParams();
    if (m.key) qs.set("todo", m.key);
    if (from) qs.set("from", from);
    const str = qs.toString();
    return { key: m.key, label: m.label, count: queues[i].length, href: str ? `/ring?${str}` : "/ring" };
  });
  if (start) {
    const at = queue.findIndex((l) => l.id === start);
    if (at > 0) queue = [...queue.slice(at), ...queue.slice(0, at)];
    else if (at === -1) {
      const lead = mine.find((l) => l.id === start && hasCallablePhone(l.phone));
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

  const backHref = from === "today" ? "/today" : mode ? `/leads?todo=${encodeURIComponent(mode)}` : "/leads";
  return (
    <CallMode
      // A new queue (mode switch) must reset the snapshot, index and stats.
      key={mode ?? "all"}
      queue={queue}
      activities={activities}
      backHref={backHref}
      modes={choices}
      activeMode={mode ?? null}
    />
  );
}
