import Link from "next/link";
import { Mail, Phone, ArrowRight, CalendarClock, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LEAD_STATUS_VARIANT, FILMING_STATUS_VARIANT } from "@/lib/status-styles";
import { LEAD_STATUS_LABELS, FILMING_STATUS_LABELS } from "@/lib/types";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { avatarToneFor, initialsFor } from "@/lib/avatar-color";
import { QuickStatus } from "@/components/leads/quick-status";
import type { Lead } from "@/lib/types";

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Mail;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-wood-600" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-wood-600">{label}</p>
        <div className="truncate text-sm text-ink">{children}</div>
      </div>
    </div>
  );
}

export function TodayLeadCard({ lead }: { lead: Lead }) {
  const displayName = lead.contact_name ?? lead.company_name ?? "?";

  return (
    <Card className="flex h-full flex-col">
      <CardContent className="flex flex-1 flex-col gap-4 pt-5">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border-2 border-ink text-sm font-bold shadow-[2px_2px_0_0_var(--color-ink)]",
              avatarToneFor(lead.id)
            )}
          >
            {initialsFor(displayName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-ink">
              {lead.company_name ?? "Ukjent firma"}
            </p>
            <p className="truncate text-sm text-wood-700">{lead.contact_name ?? "–"}</p>
          </div>
          {lead.niche && (
            <Badge variant="blue" className="max-w-[40%] truncate">
              {lead.niche.name}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant={LEAD_STATUS_VARIANT[lead.status]}>
            {LEAD_STATUS_LABELS[lead.status]}
          </Badge>
          <Badge variant={FILMING_STATUS_VARIANT[lead.filming_status]}>
            {FILMING_STATUS_LABELS[lead.filming_status]}
          </Badge>
        </div>

        <div className="grid gap-2.5 border-t-2 border-ink/15 pt-3">
          <Field icon={Phone} label="Telefon">
            {lead.phone ? (
              <a href={`tel:${lead.phone}`} className="font-mono hover:underline">
                {lead.phone}
              </a>
            ) : (
              <span className="text-wood-600">–</span>
            )}
          </Field>
          <Field icon={Mail} label="E-post">
            {lead.email ? (
              <a href={`mailto:${lead.email}`} className="hover:underline">
                {lead.email}
              </a>
            ) : (
              <span className="text-wood-600">–</span>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field icon={Wallet} label="Deal size">
              <span className="font-mono">{formatCurrency(lead.deal_size)}</span>
            </Field>
            <Field icon={CalendarClock} label="Oppfølging">
              <span className="font-mono">
                {lead.next_follow_up_at ? formatDate(lead.next_follow_up_at) : "–"}
              </span>
            </Field>
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-2 border-t-2 border-ink/15 pt-3">
          <p className="text-[10px] uppercase tracking-wide text-wood-600">Sett status</p>
          <QuickStatus leadId={lead.id} current={lead.status} />
        </div>

        <Link
          href={`/leads/${lead.id}`}
          className="inline-flex items-center justify-center gap-2 rounded-sm border-2 border-ink bg-gold-500 px-3 py-2 font-pixel text-[10px] uppercase tracking-wide text-ink shadow-[3px_3px_0_0_var(--color-ink)] transition-all hover:bg-gold-400 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_var(--color-ink)]"
        >
          Åpne lead <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}
