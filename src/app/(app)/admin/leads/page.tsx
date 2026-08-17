import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TriggerAssignmentButton } from "@/components/admin/trigger-assignment-button";
import { FetchApolloPanel } from "@/components/admin/fetch-apollo-panel";
import { ImportLeadsPanel } from "@/components/admin/import-leads-panel";
import { EnrichBatchPanel } from "@/components/admin/enrich-batch-panel";
import { BulkAssignLeadsTable } from "@/components/admin/bulk-assign-leads-table";
import { LeadMap } from "@/components/leads/lead-map";
import { ViewToggle } from "@/components/leads/view-toggle";
import { LEAD_STATUS_LABELS } from "@/lib/types";
import type { Lead, LeadStatus, Niche, Profile } from "@/lib/types";

// The "Hent nye leads" action can import and then auto-enrich up to 25 leads
// (each an Apollo call), so give its Server Action the full 60s budget.
export const maxDuration = 60;

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
    page?: string;
  }>;
}) {
  const { niche, status, view, q, period, quality, page } = await searchParams;
  const supabase = await createClient();
  const isMap = view === "map";
  const search = (q ?? "").trim();
  // PostgREST filter values can't contain the syntax chars , ( ) * so a search
  // term is sanitized before it goes into an .or() ilike filter (injection-safe).
  const safeSearch = search.replace(/[^0-9a-zæøåäöü@.\- ]/gi, "").trim();

  const PAGE_SIZE = 200;
  const pageNum = Math.max(1, Math.floor(Number(page) || 1));

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

  const [
    { data: niches },
    { data: sellers },
    { data: openLeads },
    { count: missingAll },
    { count: missingAssigned },
  ] = await Promise.all([
    supabase.from("niches").select("*").order("name"),
    // Everyone active can receive leads — incl. admins who also sell (Tobias).
    supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("is_active", true)
      .order("full_name"),
    // Current workload per assignee: open (not won/lost) assigned leads.
    supabase
      .from("leads")
      .select("assigned_to")
      .not("assigned_to", "is", null)
      .not("status", "in", '("won","lost")'),
    // Leads missing a phone that we can still enrich (have a name or Apollo id).
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .is("phone", null)
      .or("contact_name.not.is.null,apollo_person_id.not.is.null"),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .is("phone", null)
      .or("contact_name.not.is.null,apollo_person_id.not.is.null")
      .not("assigned_to", "is", null),
  ]);

  const workload: Record<string, number> = {};
  for (const row of (openLeads as { assigned_to: string | null }[] | null) ?? []) {
    if (row.assigned_to) workload[row.assigned_to] = (workload[row.assigned_to] ?? 0) + 1;
  }

  let query = supabase
    .from("leads")
    .select("*, niche:niches(*)", { count: "exact" })
    .order("created_at", { ascending: false });

  if (niche === "unclassified") query = query.is("niche_id", null);
  else if (niche) query = query.eq("niche_id", niche);
  if (status) query = query.eq("status", status as LeadStatus);
  if (periodStart) query = query.gte("created_at", periodStart);
  if (quality === "phone") query = query.not("phone", "is", null);
  // Search runs in the DB (across ALL leads, not just one page).
  if (safeSearch) {
    query = query.or(
      `company_name.ilike.*${safeSearch}*,contact_name.ilike.*${safeSearch}*,email.ilike.*${safeSearch}*`
    );
  }

  const from = (pageNum - 1) * PAGE_SIZE;
  const { data: leadsRaw, count } = await query.range(from, from + PAGE_SIZE - 1);
  const leads = (leadsRaw as Lead[] | null) ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeFrom = total === 0 ? 0 : from + 1;
  const rangeTo = from + leads.length;

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (niche) params.set("niche", niche);
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    if (period) params.set("period", period);
    if (quality) params.set("quality", quality);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/admin/leads?${qs}` : "/admin/leads";
  };

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

      <FetchApolloPanel niches={(niches as Niche[] | null) ?? []} />

      <ImportLeadsPanel />

      <EnrichBatchPanel
        missingAll={missingAll ?? 0}
        missingAssigned={missingAssigned ?? 0}
      />

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
        <>
          <BulkAssignLeadsTable
            leads={(leads as Lead[]) ?? []}
            niches={(niches as Niche[]) ?? []}
            sellers={(sellers as Pick<Profile, "id" | "full_name" | "email" | "role">[]) ?? []}
            workload={workload}
            total={total}
          />

          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono text-xs text-wood-700">
                Viser {rangeFrom}–{rangeTo} av {total} leads · side {pageNum} av {totalPages}
              </p>
              <div className="flex items-center gap-2">
                {pageNum > 1 ? (
                  <Link href={pageHref(pageNum - 1)}>
                    <Button variant="outline" size="sm">← Forrige</Button>
                  </Link>
                ) : (
                  <Button variant="outline" size="sm" disabled>← Forrige</Button>
                )}
                {pageNum < totalPages ? (
                  <Link href={pageHref(pageNum + 1)}>
                    <Button variant="outline" size="sm">Neste →</Button>
                  </Link>
                ) : (
                  <Button variant="outline" size="sm" disabled>Neste →</Button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
