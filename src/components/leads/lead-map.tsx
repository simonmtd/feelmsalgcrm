import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LEAD_STATUS_VARIANT } from "@/lib/status-styles";
import { LEAD_STATUS_LABELS } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import type { Lead, Niche } from "@/lib/types";

interface Zone {
  key: string;
  name: string;
  leads: Lead[];
}

/**
 * Pure-CSS "map" view: each niche is a zone, each lead a clickable building
 * with a nameplate sign. No canvas, no game engine, no character movement —
 * clicking a building just opens the normal lead detail page.
 */
export function LeadMap({ leads, niches }: { leads: Lead[]; niches: Niche[] }) {
  const zones: Zone[] = niches
    .map((niche) => ({
      key: niche.id,
      name: niche.name,
      leads: leads.filter((l) => l.niche_id === niche.id),
    }))
    .filter((z) => z.leads.length > 0);

  const unclassified = leads.filter((l) => !l.niche_id);
  if (unclassified.length) {
    zones.push({ key: "unclassified", name: "Uklassifisert", leads: unclassified });
  }

  if (!zones.length) {
    return (
      <Card>
        <CardContent className="pt-5 text-sm text-muted">
          Ingen leads å vise på kartet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {zones.map((zone) => (
        <Card key={zone.key}>
          <CardHeader className="pb-3">
            <CardTitle>
              {zone.name} · {zone.leads.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-line p-4">
              <div className="flex flex-wrap items-end gap-4">
                {zone.leads.map((lead) => (
                  <LeadBuilding key={lead.id} lead={lead} />
                ))}
              </div>
              {/* ground line, like the terrain edge in the reference art */}
              <div className="mt-3 h-3 rounded-md border border-line " />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function LeadBuilding({ lead }: { lead: Lead }) {
  const name = lead.company_name ?? "Ukjent firma";

  return (
    <Link
      href={`/leads/${lead.id}`}
      title={`${name} — ${LEAD_STATUS_LABELS[lead.status]}`}
      className="group flex w-36 flex-col items-center transition-transform hover:-translate-y-1"
    >
      {/* nameplate sign above the building */}
      <span className="z-10 block max-w-full truncate rounded-md border border-line bg-surface px-1.5 py-1 eyebrow uppercase tracking-wide text-fg ">
        {name}
      </span>
      <span className="h-2 w-1 border-x border-line bg-surface-3" />

      {/* the building itself */}
      <span className="flex w-full flex-col gap-1.5 rounded-md border border-line p-2 ">
        <span className="flex gap-1">
          {/* windows — lit up for won leads, dark for lost */}
          <span
            className={
              lead.status === "won"
                ? "h-4 flex-1 rounded-[1px] border border-line bg-brand-soft"
                : lead.status === "lost"
                  ? "h-4 flex-1 rounded-[1px] border border-line bg-surface"
                  : "h-4 flex-1 rounded-[1px] border border-line bg-info-soft"
            }
          />
          <span
            className={
              lead.status === "won"
                ? "h-4 flex-1 rounded-[1px] border border-line bg-brand-soft"
                : "h-4 flex-1 rounded-[1px] border border-line bg-surface"
            }
          />
        </span>
        <span className="flex items-end gap-1">
          <span className="h-5 w-1/3 rounded-[1px] border border-line bg-surface" />
          <span className="h-3 flex-1 rounded-[1px] border border-line bg-surface-3" />
        </span>
      </span>

      <span className="mt-1.5 flex flex-col items-center gap-1">
        <Badge variant={LEAD_STATUS_VARIANT[lead.status]}>
          {LEAD_STATUS_LABELS[lead.status]}
        </Badge>
        {lead.deal_size != null && (
          <span className="text-[10px] font-bold text-fg">
            {formatCurrency(lead.deal_size)}
          </span>
        )}
      </span>
    </Link>
  );
}
