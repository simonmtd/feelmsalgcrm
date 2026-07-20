import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LeadNicheSelect } from "@/components/admin/lead-niche-select";
import { LeadAssignSelect } from "@/components/admin/lead-assign-select";
import { TriggerAssignmentButton } from "@/components/admin/trigger-assignment-button";
import { LEAD_STATUS_LABELS } from "@/lib/types";
import { LEAD_STATUS_VARIANT } from "@/lib/status-styles";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Lead, LeadStatus, Niche, Profile } from "@/lib/types";

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ niche?: string; status?: string }>;
}) {
  const { niche, status } = await searchParams;
  const supabase = await createClient();

  const [{ data: niches }, { data: sellers }] = await Promise.all([
    supabase.from("niches").select("*").order("name"),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "seller")
      .eq("is_active", true),
  ]);

  let query = supabase
    .from("leads")
    .select("*, niche:niches(*)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (niche === "unclassified") query = query.is("niche_id", null);
  else if (niche) query = query.eq("niche_id", niche);
  if (status) query = query.eq("status", status as LeadStatus);

  const { data: leads } = await query;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Alle leads</h1>
          <p className="text-sm text-neutral-500">
            Klassifiser niche, omfordel selgere, følg med på pipeline.
          </p>
        </div>
        <TriggerAssignmentButton />
      </div>

      <Card>
        <CardContent className="pt-5">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-neutral-500">Niche</label>
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
              <label className="text-xs font-medium text-neutral-500">Status</label>
              <Select name="status" defaultValue={status ?? ""} className="w-44">
                <option value="">Alle</option>
                {Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => (
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

      <Card>
        <CardHeader>
          <CardTitle>{leads?.length ?? 0} leads</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase text-neutral-500">
                <th className="py-2 pr-4">Firma</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Deal size</th>
                <th className="py-2 pr-4">Niche</th>
                <th className="py-2 pr-4">Selger</th>
                <th className="py-2 pr-4">Opprettet</th>
              </tr>
            </thead>
            <tbody>
              {(leads as Lead[] | null)?.map((lead) => (
                <tr key={lead.id} className="border-b border-neutral-100">
                  <td className="py-2 pr-4">
                    <a href={`/leads/${lead.id}`} className="font-medium text-neutral-900 hover:underline">
                      {lead.company_name ?? "Ukjent firma"}
                    </a>
                    <p className="text-xs text-neutral-500">{lead.contact_name}</p>
                  </td>
                  <td className="py-2 pr-4">
                    <Badge variant={LEAD_STATUS_VARIANT[lead.status]}>
                      {LEAD_STATUS_LABELS[lead.status]}
                    </Badge>
                  </td>
                  <td className="py-2 pr-4">{formatCurrency(lead.deal_size)}</td>
                  <td className="py-2 pr-4">
                    <LeadNicheSelect
                      leadId={lead.id}
                      nicheId={lead.niche_id}
                      niches={(niches as Niche[]) ?? []}
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <LeadAssignSelect
                      leadId={lead.id}
                      assignedTo={lead.assigned_to}
                      sellers={(sellers as Pick<Profile, "id" | "full_name" | "email">[]) ?? []}
                    />
                  </td>
                  <td className="py-2 pr-4 text-neutral-500">{formatDate(lead.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!leads?.length && (
            <p className="py-6 text-center text-sm text-neutral-500">
              Ingen leads matcher filteret.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
