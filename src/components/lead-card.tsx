import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LEAD_STATUS_VARIANT, FILMING_STATUS_VARIANT } from "@/lib/status-styles";
import { LEAD_STATUS_LABELS, FILMING_STATUS_LABELS } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import type { Lead } from "@/lib/types";

export function LeadCard({ lead }: { lead: Lead }) {
  return (
    <Link href={`/leads/${lead.id}`}>
      <Card className="h-full transition-transform hover:-translate-y-0.5 hover:bg-gold-100">
        <CardContent className="flex flex-col gap-2 pt-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">
                {lead.company_name ?? "Ukjent firma"}
              </p>
              <p className="truncate text-xs text-wood-700">{lead.contact_name ?? "–"}</p>
            </div>
            {lead.niche && (
              <Badge variant="default" className="shrink-0">
                {lead.niche.name}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={LEAD_STATUS_VARIANT[lead.status]}>
              {LEAD_STATUS_LABELS[lead.status]}
            </Badge>
            <Badge variant={FILMING_STATUS_VARIANT[lead.filming_status]}>
              {FILMING_STATUS_LABELS[lead.filming_status]}
            </Badge>
            {!lead.phone && (
              <Badge variant="red" title="Mangler telefonnummer">
                Mangler tlf
              </Badge>
            )}
          </div>
          <p className="font-mono text-sm font-bold text-wood-900">
            {formatCurrency(lead.deal_size)}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
