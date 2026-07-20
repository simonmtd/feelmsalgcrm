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
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardContent className="flex flex-col gap-2 pt-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                {lead.company_name ?? "Ukjent firma"}
              </p>
              <p className="text-xs text-neutral-500">{lead.contact_name ?? "–"}</p>
            </div>
            {lead.niche && (
              <Badge variant="default">{lead.niche.name}</Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={LEAD_STATUS_VARIANT[lead.status]}>
              {LEAD_STATUS_LABELS[lead.status]}
            </Badge>
            <Badge variant={FILMING_STATUS_VARIANT[lead.filming_status]}>
              {FILMING_STATUS_LABELS[lead.filming_status]}
            </Badge>
          </div>
          <p className="text-sm font-medium text-neutral-700">
            {formatCurrency(lead.deal_size)}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
