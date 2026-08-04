import Link from "next/link";
import { requireProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TodayLeadCard } from "@/components/leads/today-lead-card";
import { PixelProgress } from "@/components/charts/pixel-progress";
import { LEAD_STATUS_LABELS } from "@/lib/types";
import { LEAD_STATUS_VARIANT } from "@/lib/status-styles";
import { formatCurrency } from "@/lib/utils";
import { isContacted } from "@/lib/dashboard-stats";
import type { Lead, LeadStatus } from "@/lib/types";

export default async function TodayPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("leads")
    .select("*, niche:niches(*)")
    .eq("assigned_to", profile.id)
    .eq("assigned_date", today)
    .order("created_at", { ascending: false });

  const leads = (data as Lead[] | null) ?? [];
  const handled = leads.filter((l) => isContacted(l.status)).length;
  const percent = leads.length ? Math.round((handled / leads.length) * 100) : 0;
  const totalValue = leads.reduce((sum, l) => sum + (l.deal_size ?? 0), 0);

  const statusCounts = (Object.keys(LEAD_STATUS_LABELS) as LeadStatus[])
    .map((status) => ({ status, count: leads.filter((l) => l.status === status).length }))
    .filter((entry) => entry.count > 0);

  const dateLabel = new Date().toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <>
      <div className="rounded-sm border-2 border-ink bg-wood-900 p-3 shadow-[4px_4px_0_0_var(--color-ink)]">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="font-pixel text-[10px] uppercase leading-relaxed tracking-wide text-gold-100">
            {handled}/{leads.length} fulgt opp i dag
          </p>
          <p className="font-mono text-[11px] text-wood-200">
            {dateLabel} · potensiell verdi {formatCurrency(totalValue)}
          </p>
        </div>
        <PixelProgress percent={percent} className="mt-2" />
      </div>

      {statusCounts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-wood-800">Status i dag:</span>
          {statusCounts.map(({ status, count }) => (
            <Badge key={status} variant={LEAD_STATUS_VARIANT[status]}>
              {LEAD_STATUS_LABELS[status]}: {count}
            </Badge>
          ))}
        </div>
      )}

      {!leads.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="font-pixel text-[10px] uppercase leading-relaxed text-wood-800">
              Ingen leads tildelt i dag
            </p>
            <p className="max-w-md text-sm text-wood-700">
              Nye leads fordeles automatisk hver morgen basert på nichen du har valgt
              {profile.active_niche?.name ? ` (${profile.active_niche.name})` : ""}. En admin kan
              også fordele leads til deg manuelt.
            </p>
            <Link
              href="/leads"
              className="font-pixel text-[10px] uppercase tracking-wide text-forest-700 hover:text-forest-500"
            >
              Se alle mine leads
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {leads.map((lead) => (
            <TodayLeadCard key={lead.id} lead={lead} />
          ))}
        </div>
      )}
    </>
  );
}
