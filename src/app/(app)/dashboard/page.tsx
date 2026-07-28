import Link from "next/link";
import { Users, CalendarPlus, Wallet, Trophy, ArrowUpRight, Filter } from "lucide-react";
import { requireProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { NicheSwitcher } from "@/components/niche-switcher";
import { RecentLeadRow } from "@/components/dashboard/recent-lead-row";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/charts/stat-card";
import { TrendBarChart } from "@/components/charts/trend-bar-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { PixelProgress } from "@/components/charts/pixel-progress";
import { computeLeadStats, weekPoints, monthPoints, yearPoints } from "@/lib/dashboard-stats";
import { formatCurrency } from "@/lib/utils";
import { LEAD_STATUS_LABELS } from "@/lib/types";
import type { Lead, LeadStatus } from "@/lib/types";

const STATUS_COLORS: Record<LeadStatus, string> = {
  new: "#9ED9F0",
  assigned: "#58B6DD",
  contacted: "#FFD24A",
  follow_up: "#E8B23A",
  won: "#3E8E38",
  lost: "#B4442F",
};

/** A lead counts as "followed up" once it has moved past the untouched new/assigned stages. */
const TOUCHED_STATUSES = new Set<LeadStatus>(["contacted", "follow_up", "won", "lost"]);

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const isAdmin = profile.role === "admin";

  const { data: niches } = await supabase.from("niches").select("*").order("name");

  let scopedLeads: Lead[];
  let recentLeads: Lead[];

  if (isAdmin) {
    const { data: allLeads } = await supabase.from("leads").select("*");
    scopedLeads = (allLeads as Lead[] | null) ?? [];
    recentLeads = [...scopedLeads]
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, 6);
    const nicheById = new Map((niches ?? []).map((n) => [n.id, n]));
    recentLeads = recentLeads.map((l) => ({ ...l, niche: l.niche_id ? nicheById.get(l.niche_id) ?? null : null }));
  } else {
    const { data: myLeadsRaw } = await supabase.from("leads").select("*").eq("assigned_to", profile.id);
    scopedLeads = (myLeadsRaw as Lead[] | null) ?? [];

    const today = new Date().toISOString().slice(0, 10);
    const { data: todaysLeads } = await supabase
      .from("leads")
      .select("*, niche:niches(*)")
      .eq("assigned_to", profile.id)
      .eq("assigned_date", today)
      .order("created_at", { ascending: false });
    recentLeads = (todaysLeads as Lead[] | null) ?? [];
  }

  const stats = computeLeadStats(scopedLeads);

  // Sellers track today's assigned leads; for an admin that set is always freshly
  // created (and so always 0% followed up), so they get whole-portfolio progress.
  const progressPool = isAdmin ? scopedLeads : recentLeads;
  const followedUp = progressPool.filter((l) => TOUCHED_STATUSES.has(l.status)).length;
  const followUpPercent = progressPool.length
    ? Math.round((followedUp / progressPool.length) * 100)
    : 0;

  const statusSegments = (Object.keys(LEAD_STATUS_LABELS) as LeadStatus[])
    .map((status) => ({
      label: LEAD_STATUS_LABELS[status],
      value: scopedLeads.filter((l) => l.status === status).length,
      color: STATUS_COLORS[status],
    }))
    .filter((segment) => segment.value > 0);

  return (
    <>
      <div className="rounded-sm border-2 border-ink bg-wood-900 p-3 shadow-[4px_4px_0_0_var(--color-ink)]">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="font-pixel text-[10px] uppercase leading-relaxed tracking-wide text-gold-100">
            {isAdmin ? "Porteføljen" : "Dagens analyse"} · {followedUp}/{progressPool.length} leads
            fulgt opp
          </p>
          <p className="font-mono text-[11px] text-wood-200">
            {stats.openCount} åpne · {stats.winRate}% vinnrate
          </p>
        </div>
        <PixelProgress percent={followUpPercent} className="mt-2" />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-wood-800">
          {isAdmin
            ? `Hei ${profile.full_name ?? profile.email}, her er status for hele porteføljen.`
            : `Hei ${profile.full_name ?? profile.email}, her er status for pipelinen din.`}
        </p>
        {isAdmin ? (
          <Link
            href="/admin/leads"
            className="inline-flex items-center gap-1.5 font-pixel text-[10px] uppercase tracking-wide text-forest-700 hover:text-forest-500"
          >
            Se alle leads <ArrowUpRight className="h-4 w-4" />
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-wood-800">Niche:</span>
            <div className="w-48">
              <NicheSwitcher niches={niches ?? []} activeNicheId={profile.active_niche_id} />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={isAdmin ? "Åpne leads (alle)" : "Åpne leads"}
          value={stats.openCount}
          trend={stats.openTrend}
          icon={Users}
          tone="blue"
          chartValues={stats.miniOpen}
          info={
            <>
              <p>
                Leads med status Ny, Tildelt, Kontaktet eller Følges opp
                {isAdmin ? " på tvers av hele teamet" : " som er tildelt deg"} — altså alt som
                ikke er vunnet eller tapt.
              </p>
              <p>Søylene viser åpne leads opprettet hver av de siste 7 dagene.</p>
            </>
          }
        />
        <StatCard
          label="Nye leads (7d)"
          value={stats.newThisWeek}
          trend={stats.newTrend}
          icon={CalendarPlus}
          tone="purple"
          chartValues={stats.miniNew}
          info={
            <>
              <p>
                Leads opprettet de siste 7 dagene
                {isAdmin ? " i hele systemet" : " som er tildelt deg"}.
              </p>
              <p>Endringen sammenligner med de 7 dagene før det.</p>
            </>
          }
        />
        <StatCard
          label={isAdmin ? "Vunnet verdi (alle)" : "Vunnet verdi"}
          value={formatCurrency(stats.dealValue)}
          trend={stats.dealTrend}
          icon={Wallet}
          tone="green"
          chartValues={stats.miniDeal}
          info={
            <>
              <p>
                Summen av deal size for alle leads med status Vunnet. Leads uten utfylt deal
                size teller som 0.
              </p>
              <p>
                Merk: endringen grupperes etter når leaden ble <em>opprettet</em>, ikke når den
                ble vunnet.
              </p>
            </>
          }
        />
        <StatCard
          label={isAdmin ? "Vinnrate (alle)" : "Vinnrate"}
          value={`${stats.winRate}%`}
          trend={stats.wonTrend}
          icon={Trophy}
          tone="orange"
          ring={stats.winRate}
          info={
            <>
              <p>
                Vunnet delt på avsluttede leads (vunnet + tapt). Åpne leads holdes utenfor, så
                tallet endrer seg først når en lead avsluttes.
              </p>
              <p>Fremdriftslinjen viser samme prosent.</p>
            </>
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TrendBarChart
            title={isAdmin ? "Nye leads over tid (alle)" : "Nye leads over tid"}
            datasets={[
              { key: "week", label: "Uke", points: weekPoints(scopedLeads) },
              { key: "month", label: "Måned", points: monthPoints(scopedLeads) },
              { key: "year", label: "År", points: yearPoints(scopedLeads) },
            ]}
          />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Leads etter status</CardTitle>
          </CardHeader>
          <CardContent>
            {statusSegments.length ? (
              <DonutChart segments={statusSegments} centerIcon={Filter} />
            ) : (
              <p className="py-10 text-center text-sm text-wood-700">Ingen leads ennå.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isAdmin ? "Nylig opprettede leads" : "Dagens leads"}</CardTitle>
        </CardHeader>
        <CardContent>
          {!recentLeads.length ? (
            <p className="py-6 text-center text-sm text-wood-700">
              {isAdmin
                ? "Ingen leads i systemet ennå."
                : "Ingen nye leads tildelt i dag ennå. Nye leads fordeles automatisk hver morgen basert på din valgte niche."}
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {recentLeads.map((lead) => (
                <RecentLeadRow key={lead.id} lead={lead} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
