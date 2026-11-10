import { requireProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { LeadCard } from "@/components/lead-card";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button, buttonVariants } from "@/components/ui/button";
import { LeadMap } from "@/components/leads/lead-map";
import { ViewToggle } from "@/components/leads/view-toggle";
import { LeadBoard } from "@/components/leads/lead-board";
import { applyTodoFilter } from "@/lib/lead-filters";
import { NewLeadForm } from "@/components/leads/new-lead-form";
import { LogCallForm } from "@/components/leads/log-call-form";
import Link from "next/link";
import { PhoneCall } from "lucide-react";
import { LEAD_STATUS_LABELS, FILMING_STATUS_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { Lead, LeadStatus, FilmingStatus, Niche, Profile } from "@/lib/types";

function TodoChip({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border border-line px-3 py-1 text-xs font-medium transition-colors",
        active ? "border-brand/40 bg-brand-soft text-brand" : "text-muted hover:border-line-strong hover:text-fg"
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
    q?: string;
  }>;
}) {
  const profile = await requireProfile();
  const { status, filming, view, todo, quality, q } = await searchParams;
  const supabase = await createClient();
  const isAdmin = profile.role === "admin";
  const isMap = view === "map";
  const isBoard = view === "board";
  const search = (q ?? "").trim().toLowerCase();

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
  leads = await applyTodoFilter(supabase, profile.id, leads, todo);

  // Free-text search across the fields a seller looks a lead up by.
  if (search) {
    leads = leads.filter((l) =>
      [l.company_name, l.contact_name, l.email, l.phone]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(search))
    );
  }

  const { data: niches } = await supabase.from("niches").select("*").order("name");

  // Admins can hand their own leads over to a seller straight from the card.
  const { data: sellersData } = isAdmin
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("is_active", true)
        .order("full_name")
    : { data: null };
  const sellers = (sellersData as Pick<Profile, "id" | "full_name" | "email">[] | null) ?? [];

  // Chips keep the current view (list/board/map) when switching filter.
  const todoHref = (t?: string) => {
    const qs = new URLSearchParams();
    if (t) qs.set("todo", t);
    if (view) qs.set("view", view);
    const str = qs.toString();
    return str ? `/leads?${str}` : "/leads";
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <TodoChip label="Alle" href={todoHref()} active={!todo} />
          <TodoChip label="Ikke kontaktet" href={todoHref("uncontacted")} active={todo === "uncontacted"} />
          <TodoChip label="Ikke svar" href={todoHref("no_answer")} active={todo === "no_answer"} />
          <TodoChip label="Forfalt oppfølging" href={todoHref("overdue")} active={todo === "overdue"} />
          <TodoChip label="Glemt (3d+)" href={todoHref("stale")} active={todo === "stale"} />
        </div>
        <ViewToggle
          basePath="/leads"
          params={{ status, filming, todo, quality, q }}
          active={isMap ? "map" : isBoard ? "board" : "list"}
          withBoard
        />
      </div>

      <div className="flex justify-end">
        <Link href={todo ? `/ring?todo=${todo}` : "/ring"} className={buttonVariants()}>
          <PhoneCall /> Start ringing
        </Link>
      </div>

      <NewLeadForm
        niches={(niches as Niche[]) ?? []}
        defaultNicheId={profile.active_niche_id}
      />

      <LogCallForm />

      <Card>
        <CardContent className="pt-5">
          <form method="get" className="flex flex-wrap items-end gap-3">
            {todo && <input type="hidden" name="todo" value={todo} />}
            {view && <input type="hidden" name="view" value={view} />}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lead-search" className="text-xs text-muted">
                Søk
              </Label>
              <Input
                id="lead-search"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Firma, kontakt, e-post eller telefon…"
                className="w-64"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted">Status</label>
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
              <label className="text-xs font-medium text-muted">Filming</label>
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
              <label className="text-xs font-medium text-muted">Kvalitet</label>
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
          <CardContent className="pt-5 text-sm text-muted">
            {search
              ? `Ingen leads matcher søket «${q}».`
              : "Ingen leads matcher filteret."}
          </CardContent>
        </Card>
      ) : isMap ? (
        <LeadMap leads={leads as Lead[]} niches={(niches as Niche[]) ?? []} />
      ) : isBoard ? (
        <LeadBoard leads={leads as Lead[]} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(leads as Lead[]).map((lead) => (
            <LeadCard key={lead.id} lead={lead} sellers={isAdmin ? sellers : undefined} />
          ))}
        </div>
      )}
    </>
  );
}
