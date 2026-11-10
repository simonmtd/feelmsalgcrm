import Link from "next/link";
import { fetchAll } from "@/lib/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TriggerAssignmentButton } from "@/components/admin/trigger-assignment-button";
import { FetchApolloPanel } from "@/components/admin/fetch-apollo-panel";
import { ImportLeadsPanel } from "@/components/admin/import-leads-panel";
import { EnrichBatchPanel } from "@/components/admin/enrich-batch-panel";
import { LeadTools } from "@/components/admin/lead-tools";
import { LeadReviewTable } from "@/components/admin/lead-review-table";
import { AutoClassifyButton } from "@/components/admin/auto-classify-button";
import { TodoTiles } from "@/components/leads/todo-tiles";
import { AutoFilterForm } from "@/components/ui/auto-filter-form";
import { Search } from "lucide-react";
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
    pool?: string;
  }>;
}) {
  const { niche, status, view, q, period, quality, page, pool } = await searchParams;
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
    openLeads,
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
    fetchAll<{ assigned_to: string | null }>((from, to) =>
      supabase
        .from("leads")
        .select("assigned_to")
        .not("assigned_to", "is", null)
        .not("status", "in", '("won","lost")')
        .order("id")
        .range(from, to)
    ),
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

  // Pool tiles: what an admin scans this page for. "Kan ringes igjen" = open
  // leads that were called, didn't end in a final outcome, and haven't been
  // called in the last 2 days.
  const OPEN = '("new","assigned","contacted","follow_up")';
  const now = new Date();
  const nowIso = now.toISOString();
  const twoDays = new Date(now);
  twoDays.setDate(twoDays.getDate() - 2);
  const twoDaysAgo = twoDays.toISOString();
  const countOf = (build: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => build(base());
  function base() {
    return supabase.from("leads").select("id", { count: "exact", head: true });
  }
  const [cAll, cCallback, cInterested, cOverdue, cUnassigned, cNoNiche] = await Promise.all([
    countOf((q) => q),
    countOf((q) =>
      q
        .filter("status", "in", OPEN)
        .in("last_call_outcome", ["no_answer", "voicemail", "interested"])
        .lte("last_call_at", twoDaysAgo)
    ),
    countOf((q) => q.filter("status", "in", OPEN).eq("last_call_outcome", "interested")),
    countOf((q) => q.filter("status", "in", OPEN).lte("next_follow_up_at", nowIso)),
    countOf((q) => q.is("assigned_to", null).filter("status", "in", OPEN)),
    countOf((q) => q.is("niche_id", null)),
  ]);

  const workload: Record<string, number> = {};
  for (const row of openLeads) {
    if (row.assigned_to) workload[row.assigned_to] = (workload[row.assigned_to] ?? 0) + 1;
  }

  let query = supabase
    .from("leads")
    .select("*, niche:niches(*)", { count: "exact" })
    // Callback lists read oldest-call-first (longest waiting at the top).
    .order(pool === "callback" ? "last_call_at" : "created_at", { ascending: pool === "callback" });

  if (pool === "callback") {
    query = query
      .filter("status", "in", OPEN)
      .in("last_call_outcome", ["no_answer", "voicemail", "interested"])
      .lte("last_call_at", twoDaysAgo);
  } else if (pool === "interested") {
    query = query.filter("status", "in", OPEN).eq("last_call_outcome", "interested");
  } else if (pool === "overdue") {
    query = query.filter("status", "in", OPEN).lte("next_follow_up_at", nowIso);
  } else if (pool === "unassigned") {
    query = query.is("assigned_to", null).filter("status", "in", OPEN);
  } else if (pool === "no_niche") {
    query = query.is("niche_id", null);
  }

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
    if (pool) params.set("pool", pool);
    if (niche) params.set("niche", niche);
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    if (period) params.set("period", period);
    if (quality) params.set("quality", quality);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/admin/leads?${qs}` : "/admin/leads";
  };

  const poolHref = (key?: string) => {
    const params = new URLSearchParams();
    if (key) params.set("pool", key);
    if (view) params.set("view", view);
    const qs = params.toString();
    return qs ? `/admin/leads?${qs}` : "/admin/leads";
  };

  return (
    <>
      <TodoTiles
        active={pool ?? null}
        tiles={[
          { key: null, label: "Alle leads", hint: "i systemet", count: cAll.count ?? 0, href: poolHref() },
          { key: "callback", label: "Kan ringes igjen", hint: "ringt før, ikke avsluttet", count: cCallback.count ?? 0, href: poolHref("callback") },
          { key: "interested", label: "Interessert", hint: "varme leads", count: cInterested.count ?? 0, href: poolHref("interested") },
          { key: "overdue", label: "Forfalt", hint: "oppfølging over frist", count: cOverdue.count ?? 0, href: poolHref("overdue"), urgent: true },
          { key: "unassigned", label: "Ikke tildelt", hint: "åpne leads i poolen", count: cUnassigned.count ?? 0, href: poolHref("unassigned") },
          { key: "no_niche", label: "Mangler nisje", hint: "må sorteres", count: cNoNiche.count ?? 0, href: poolHref("no_niche") },
        ]}
      />

      <LeadTools
        apollo={<FetchApolloPanel niches={(niches as Niche[] | null) ?? []} />}
        csv={<ImportLeadsPanel />}
        enrich={<EnrichBatchPanel missingAll={missingAll ?? 0} missingAssigned={missingAssigned ?? 0} />}
        actions={
          <>
            <AutoClassifyButton />
            <ViewToggle
              basePath="/admin/leads"
              params={{ pool, niche, status, q, period, quality }}
              active={isMap ? "map" : "list"}
            />
            <TriggerAssignmentButton />
          </>
        }
      />

      <AutoFilterForm hidden={{ pool, view }}>
        <div className="relative w-full sm:w-60">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <Input name="q" aria-label="Søk" defaultValue={q ?? ""} placeholder="Søk firma, kontakt, e-post…" className="pl-9" />
        </div>
        <Select name="niche" aria-label="Nisje" defaultValue={niche ?? ""} className="w-auto">
          <option value="">Alle nisjer</option>
          <option value="unclassified">Uten nisje</option>
          {(niches as Niche[] | null)?.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </Select>
        <Select name="status" aria-label="Status" defaultValue={status ?? ""} className="w-auto">
          <option value="">Alle statuser</option>
          {Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select name="period" aria-label="Periode" defaultValue={period ?? ""} className="w-auto">
          <option value="">Hele tiden</option>
          <option value="today">Nye i dag</option>
          <option value="week">Siste 7 dager</option>
        </Select>
        <Select name="quality" aria-label="Kvalitet" defaultValue={quality ?? ""} className="w-auto">
          <option value="">Med/uten tlf.</option>
          <option value="phone">Kun med telefon</option>
        </Select>
      </AutoFilterForm>

      {isMap ? (
        <LeadMap
          leads={(leads as Lead[]) ?? []}
          niches={(niches as Niche[]) ?? []}
        />
      ) : (
        <>
          <LeadReviewTable
            leads={(leads as Lead[]) ?? []}
            niches={(niches as Niche[]) ?? []}
            sellers={(sellers as Pick<Profile, "id" | "full_name" | "email" | "role">[]) ?? []}
            workload={workload}
            total={total}
          />

          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted">
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
