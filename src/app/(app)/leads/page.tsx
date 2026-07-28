import { requireProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { LeadCard } from "@/components/lead-card";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LeadMap } from "@/components/leads/lead-map";
import { ViewToggle } from "@/components/leads/view-toggle";
import { LEAD_STATUS_LABELS, FILMING_STATUS_LABELS } from "@/lib/types";
import type { Lead, LeadStatus, FilmingStatus, Niche } from "@/lib/types";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; filming?: string; view?: string }>;
}) {
  const profile = await requireProfile();
  const { status, filming, view } = await searchParams;
  const supabase = await createClient();
  const isMap = view === "map";

  let query = supabase
    .from("leads")
    .select("*, niche:niches(*)")
    .eq("assigned_to", profile.id)
    .order("updated_at", { ascending: false });

  if (status) query = query.eq("status", status as LeadStatus);
  if (filming) query = query.eq("filming_status", filming as FilmingStatus);

  const { data: leads } = await query;
  const { data: niches } = await supabase.from("niches").select("*").order("name");

  return (
    <>
      <div className="flex justify-end">
        <ViewToggle
          basePath="/leads"
          params={{ status, filming }}
          active={isMap ? "map" : "list"}
        />
      </div>

      <Card>
        <CardContent className="pt-5">
          <form method="get" className="flex flex-wrap items-end gap-3">
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
