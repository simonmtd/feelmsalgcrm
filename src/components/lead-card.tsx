import Link from "next/link";
import { Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LeadAssignSelect } from "@/components/admin/lead-assign-select";
import { CallOutcomeButtons } from "@/components/leads/call-outcome-buttons";
import { LEAD_STATUS_VARIANT, FILMING_STATUS_VARIANT } from "@/lib/status-styles";
import { LEAD_STATUS_LABELS, FILMING_STATUS_LABELS } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import type { Lead, Profile } from "@/lib/types";

export function LeadCard({
  lead,
  sellers,
}: {
  lead: Lead;
  /** When provided (admin), shows a "tildel til selger"-dropdown on the card. */
  sellers?: Pick<Profile, "id" | "full_name" | "email">[];
}) {
  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-2 pt-5">
        <Link
          href={`/leads/${lead.id}`}
          className="group flex flex-col gap-2 rounded-sm transition-colors hover:bg-gold-100"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink group-hover:underline">
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
          </div>
          {lead.email && (
            <p className="flex items-center gap-1.5 truncate text-xs text-wood-700">
              <Mail className="h-3 w-3 shrink-0" /> {lead.email}
            </p>
          )}
          {lead.deal_size != null && (
            <p className="font-mono text-sm font-bold text-wood-900">
              {formatCurrency(lead.deal_size)}
            </p>
          )}
        </Link>

        {/* Call + log an outcome straight from the card. */}
        <div className="mt-auto border-t border-ink/15 pt-2">
          <CallOutcomeButtons leadId={lead.id} phone={lead.phone} />
        </div>

        {sellers && (
          <div className="flex flex-col gap-1 border-t border-ink/15 pt-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-wood-600">
              Tildel selger
            </span>
            <LeadAssignSelect
              leadId={lead.id}
              assignedTo={lead.assigned_to}
              sellers={sellers}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
