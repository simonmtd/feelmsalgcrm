import { requireProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { LeadCard } from "@/components/lead-card";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LeadMap } from "@/components/leads/lead-map";
import { ViewToggle } from "@/components/leads/view-toggle";
import Link from "next/link";
import { LEAD_STATUS_LABELS, FILMING_STATUS_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { Lead, LeadStatus, FilmingStatus, Niche } from "@/lib/types";

function TodoChip({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-sm border-2 border-ink px-2.5 py-1 font-pixel text-[8px] uppercase tracking-wide shadow-[2px_2px_0_0_var(--color-ink)] transition-colors",
        active ? "bg-gold-500 text-ink" : "bg-parchment text-wood-800 hover:bg-gold-100"
      )}
    >
      {label}
    </Link>
  );
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    filming?: string;
    view?: string;
    todo?: string;
    quality?: string;
  }>;
}) {
  const profile = await requireProfile();
  const { status, filming, view, todo, quality } = await searchParams;
  const supabase = await createClient();
  const isMap = view === "map";

  let query = supabase
    .from("leads")
    .select("*, niche:niches(*)")
    .eq("assigned_to", profile.id)
    .order("updated_at", { ascending: false });

  if (status) query = query.eq("status", status as LeadStatus);
  if (filming) query = query.eq("filming_status", filming as FilmingStatus);
  if (quality === "phone") query = query.not("phone", "is", null);

  const { data: leadsRaw } = await query;
  let leads = (leadsRaw as Lead[] | null) ?? [];

  // "Å gjøre"-filtre for å hindre at leads faller mellom stolene.
  if (todo === "uncontacted") {
    leads = leads.filter((l) => l.status === "new" || l.status === "assigned");
  } else if (todo === "overdue") {
    const now = new Date().getTime();
    leads = leads.filter(
      (l) =>
        ["new", "assigned", "contacted", "follow_up"].includes(l.status) &&
        l.next_follow_up_at != null &&
        new Date(l.next_follow_up_at).getTime() <= now
    );
  } else if (todo === "stale") {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 3);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    leads = leads.filter(
      (l) =>
        (l.status === "new" || l.status === "assigned") &&
        l.assigned_date != null &&
        l.assigned_date <= cutoffStr
    );
  }

  const { data: niches } = await supabase.from("niches").select("*").order("name");

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <TodoChip label="Alle" href="/leads" active={!todo} />
          <TodoChip label="Ikke kontaktet" href="/leads?todo=uncontacted" active={todo === "uncontacted"} />
          <TodoChip label="Forfalt oppfølging" href="/leads?todo=overdue" active={todo === "overdue"} />
          <TodoChip label="Glemt (3d+)" href="/leads?todo=stale" active={todo === "stale"} />
        </div>
        <ViewToggle
          basePath="/leads"
          params={{ status, filming, todo, quality }}
          active={isMap ? "map" : "list"}
        />
      </div>

      <Card>
        <CardContent className="pt-5">
          <form method="get" className="flex flex-wrap items-end gap-3">
            {todo && <input type="hidden" name="todo" value={todo} />}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-wood-700">Status</label>
              <Select name="status" defaultValue={status ?? ""} className="w-44">
                <option value="">Alle</option>
                {Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-wood-700">Filming</label>
              <Select name="filming" defaultValue={filming ?? ""} className="w-44">
                <option value="">Alle</option>
                {Object.entries(FILMING_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-wood-700">Kvalitet</label>
              <Select name="quality" defaultValue={quality ?? ""} className="w-40">
                <option value="">Alle</option>
                <option value="phone">Kun med telefon</option>
              </Select>
            </div>
            <Button type="submit" variant="outline">
              Filtrer
            </Button>
          </form>
        </CardContent>
      </Card>

      {!leads?.length ? (
        <Card>
          <CardContent className="pt-5 text-sm text-wood-700">
            Ingen leads matcher filteret.
          </CardContent>
        </Card>
      ) : isMap ? (
        <LeadMap leads={leads as Lead[]} niches={(niches as Niche[]) ?? []} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(leads as Lead[]).map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </div>
      )}
    </>
  );
}
