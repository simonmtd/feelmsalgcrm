import { requireProfile } from "@/lib/dal";
import { fetchAll } from "@/lib/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { MyLeadsTable } from "@/components/leads/my-leads-table";
import { Card, CardContent } from "@/components/ui/card";
import { LeadMap } from "@/components/leads/lead-map";
import { ViewToggle } from "@/components/leads/view-toggle";
import { LeadBoard } from "@/components/leads/lead-board";
import { applyTodoFilter, callQueue } from "@/lib/lead-filters";
import { TodoTiles } from "@/components/leads/todo-tiles";
import { LeadsToolbar } from "@/components/leads/leads-toolbar";
import type { Lead, LeadStatus, FilmingStatus, Niche } from "@/lib/types";

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
  const isMap = view === "map";
  const isBoard = view === "board";
  const search = (q ?? "").trim().toLowerCase();

  // All of the seller's leads once: the tiles count over this, the list
  // narrows it with the dropdown filters, the todo filter and the search.
  const mine = await fetchAll<Lead>((from, to) =>
    supabase
      .from("leads")
      .select("*, niche:niches(*)")
      .eq("assigned_to", profile.id)
      .order("updated_at", { ascending: false })
      .order("id")
      .range(from, to)
  );

  const todoKeys = ["uncontacted", "no_answer", "overdue", "stale"] as const;
  const todoCounts = Object.fromEntries(
    todoKeys.map((k) => [k, applyTodoFilter(mine, k).length] as const)
  ) as Record<(typeof todoKeys)[number], number>;
  const queueCount = callQueue(applyTodoFilter(mine, todo)).length;

  let leads = mine.filter(
    (l) =>
      (!status || l.status === (status as LeadStatus)) &&
      (!filming || l.filming_status === (filming as FilmingStatus)) &&
      (quality !== "phone" || !!l.phone)
  );

  // "Å gjøre"-filtre for å hindre at leads faller mellom stolene.
  leads = applyTodoFilter(leads, todo);

  // Free-text search across the fields a seller looks a lead up by.
  if (search) {
    leads = leads.filter((l) =>
      [l.company_name, l.contact_name, l.email, l.phone]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(search))
    );
  }

  const { data: niches } = await supabase.from("niches").select("*").order("name");


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
      <TodoTiles
        active={todo ?? null}
        queueCount={queueCount}
        ringHref={todo ? `/ring?todo=${todo}` : "/ring"}
        tiles={[
          { key: null, label: "Alle", hint: "leads tildelt deg", count: mine.length, href: todoHref() },
          { key: "uncontacted", label: "Ikke kontaktet", hint: "aldri ringt", count: todoCounts.uncontacted, href: todoHref("uncontacted") },
          { key: "no_answer", label: "Ikke svar", hint: "ring tilbake", count: todoCounts.no_answer, href: todoHref("no_answer") },
          { key: "overdue", label: "Forfalt", hint: "oppfølging over frist", count: todoCounts.overdue, href: todoHref("overdue"), urgent: true },
          { key: "stale", label: "Glemt", hint: "tildelt for 3+ dager siden", count: todoCounts.stale, href: todoHref("stale"), urgent: true },
        ]}
      />

      <LeadsToolbar
        filters={{ q, status, filming, quality }}
        hidden={{ todo, view }}
        niches={(niches as Niche[]) ?? []}
        defaultNicheId={profile.active_niche_id}
        viewToggle={
          <ViewToggle
            basePath="/leads"
            params={{ status, filming, todo, quality, q }}
            active={isMap ? "map" : isBoard ? "board" : "list"}
            withBoard
          />
        }
      />

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
        <MyLeadsTable leads={leads as Lead[]} ringBase={todo ? `/ring?todo=${todo}` : "/ring"} />
      )}
    </>
  );
}
