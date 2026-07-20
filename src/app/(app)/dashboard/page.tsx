import { requireProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { NicheSwitcher } from "@/components/niche-switcher";
import { LeadCard } from "@/components/lead-card";
import { Card, CardContent } from "@/components/ui/card";
import type { Lead } from "@/lib/types";

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          {label}
        </p>
        <p className="mt-1 text-2xl font-semibold text-neutral-900">{value}</p>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: niches } = await supabase.from("niches").select("*").order("name");

  const today = new Date().toISOString().slice(0, 10);
  const { data: todaysLeads } = await supabase
    .from("leads")
    .select("*, niche:niches(*)")
    .eq("assigned_to", profile.id)
    .eq("assigned_date", today)
    .order("created_at", { ascending: false });

  const { count: openCount } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("assigned_to", profile.id)
    .not("status", "in", '("won","lost")');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">
            Hei, {profile.full_name ?? profile.email}
          </h1>
          <p className="text-sm text-neutral-500">Her er dine leads for i dag.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-500">Niche:</span>
          <div className="w-48">
            <NicheSwitcher
              niches={niches ?? []}
              activeNicheId={profile.active_niche_id}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <SummaryCard label="Leads i dag" value={todaysLeads?.length ?? 0} />
        <SummaryCard label="Åpne leads totalt" value={openCount ?? 0} />
        <SummaryCard label="Aktiv niche" value={profile.active_niche?.name ?? "Ingen valgt"} />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-neutral-700">Dagens leads</h2>
        {!todaysLeads?.length && (
          <Card>
            <CardContent className="pt-5 text-sm text-neutral-500">
              Ingen nye leads tildelt i dag ennå. Nye leads fordeles automatisk hver
              morgen basert på din valgte niche.
            </CardContent>
          </Card>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(todaysLeads as Lead[] | null)?.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </div>
      </div>
    </div>
  );
}
