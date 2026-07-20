import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateNicheForm } from "@/components/admin/create-niche-form";
import type { Niche } from "@/lib/types";

export default async function AdminNichesPage() {
  const supabase = await createClient();

  const { data: niches } = await supabase.from("niches").select("*").order("name");

  const { data: leadCounts } = await supabase
    .from("leads")
    .select("niche_id")
    .not("niche_id", "is", null);

  const countsByNiche = (leadCounts ?? []).reduce<Record<string, number>>((acc, row) => {
    if (row.niche_id) acc[row.niche_id] = (acc[row.niche_id] ?? 0) + 1;
    return acc;
  }, {});

  const { count: unclassifiedCount } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .is("niche_id", null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Nicher</h1>
        <p className="text-sm text-neutral-500">
          Selgerne velger selv hvilken niche de jobber med hver dag.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ny niche</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateNicheForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alle nicher</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(niches as Niche[] | null)?.map((niche) => (
            <div
              key={niche.id}
              className="flex items-center justify-between border-b border-neutral-100 py-2 text-sm last:border-0"
            >
              <span className="font-medium text-neutral-900">{niche.name}</span>
              <span className="text-neutral-500">
                {countsByNiche[niche.id] ?? 0} leads
              </span>
            </div>
          ))}
          {!niches?.length && (
            <p className="text-sm text-neutral-500">Ingen nicher opprettet ennå.</p>
          )}
        </CardContent>
      </Card>

      {(unclassifiedCount ?? 0) > 0 && (
        <Card>
          <CardContent className="pt-5 text-sm text-neutral-600">
            {unclassifiedCount} leads mangler niche.{" "}
            <a href="/admin/leads?niche=unclassified" className="font-medium underline">
              Klassifiser dem her
            </a>
            .
          </CardContent>
        </Card>
      )}
    </div>
  );
}
