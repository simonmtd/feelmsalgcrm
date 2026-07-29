import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TriggerAssignmentButton } from "@/components/admin/trigger-assignment-button";
import { BulkAssignLeadsTable } from "@/components/admin/bulk-assign-leads-table";
import { LeadMap } from "@/components/leads/lead-map";
import { ViewToggle } from "@/components/leads/view-toggle";
import { LEAD_STATUS_LABELS } from "@/lib/types";
import type { Lead, LeadStatus, Niche, Profile } from "@/lib/types";

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    niche?: string;
    status?: string;
    view?: string;
    q?: string;
    period?: string;
    quality?: string;
  }>;
}) {
  const { niche, status, view, q, period, quality } = await searchParams;
  const supabase = await createClient();
  const isMap = view === "map";
  const search = (q ?? "").trim().toLowerCase();

  // Start of the selected period (local time), for the "new leads" filter.
  let periodStart: string | null = null;
  if (period === "today") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    periodStart = d.toISOString();
  } else if (period === "week") {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    periodStart = d.toISOString();
  }

  const [{ data: niches }, { data: sellers }, { data: openLeads }] = await Promise.all([
    supabase.from("niches").select("*").order("name"),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "seller")
      .eq("is_active", true),
    // Current workload per seller: open (not won/lost) assigned leads.
    supabase
      .from("leads")
      .select("assigned_to")
      .not("assigned_to", "is", null)
      .not("status", "in", '("won","lost")'),
  ]);

  const workload: Record<string, number> = {};
  for (const row of (openLeads as { assigned_to: string | null }[] | null) ?? []) {
    if (row.assigned_to) workload[row.assigned_to] = (workload[row.assigned_to] ?? 0) + 1;
  }

  let query = supabase
    .from("leads")
    .select("*, niche:niches(*)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (niche === "unclassified") query = query.is("niche_id", null);
  else if (niche) query = query.eq("niche_id", niche);
  if (status) query = query.eq("status", status as LeadStatus);
  if (periodStart) query = query.gte("created_at", periodStart);
  if (quality === "phone") query = query.not("phone", "is", null);

  const { data: leadsRaw } = await query;
  const leads = search
    ? ((leadsRaw as Lead[] | null) ?? []).filter((l) =>
        [l.company_name, l.contact_name, l.email]
          .filter(Boolean)
          .some((field) => field!.toLowerCase().includes(search))
      )
    : (leadsRaw as Lead[] | null) ?? [];

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <ViewToggle
          basePath="/admin/leads"
          params={{ niche, status, q, period, quality }}
          active={isMap ? "map" : "list"}
        />
        <TriggerAssignmentButton />
      </div>

      <Card>
        <CardContent className="pt-5">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-wood-700">Søk</label>
              <Input
                name="q"
                defaultValue={q ?? ""}
                placeholder="Firma, kontakt eller e-post…"
                className="w-60"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-wood-700">Niche</label>
              <Select name="niche" defaultValue={niche ?? ""} className="w-48">
                <option value="">Alle</option>
                <option value="unclassified">Ikke klassifisert</option>
                {(niches as Niche[] | null)?.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-wood-700">
                Status
              </label>
              <Select
                name="status"
                defaultValue={status ?? ""}
                className="w-44"
              >
                <option value="">Alle</option>
                {Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-wood-700">Periode</label>
              <Select name="period" defaultValue={period ?? ""} className="w-40">
                <option value="">Hele tiden</option>
                <option value="today">Nye i dag</option>
                <option value="week">Siste 7 dager</option>
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

      {isMap ? (
        <LeadMap
          leads={(leads as Lead[]) ?? []}
          niches={(niches as Niche[]) ?? []}
        />
      ) : (
        <BulkAssignLeadsTable
          leads={(leads as Lead[]) ?? []}
          niches={(niches as Niche[]) ?? []}
          sellers={(sellers as Pick<Profile, "id" | "full_name" | "email">[]) ?? []}
          workload={workload}
        />
      )}
    </>
  );
}
