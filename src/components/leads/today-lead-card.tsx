import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
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
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-subtle">{label}</p>
        <div className="truncate text-sm text-fg">{children}</div>
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
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-line text-sm font-bold ",
              avatarToneFor(lead.id)
            )}
          >
            {initialsFor(displayName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-fg">
              {lead.company_name ?? "Ukjent firma"}
            </p>
            <p className="truncate text-sm text-muted">{lead.contact_name ?? "–"}</p>
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

        <div className="grid gap-2.5 border-t border-line pt-3">
          <Field icon={Phone} label="Telefon">
            {lead.phone ? (
              <a href={`tel:${lead.phone}`} className="hover:underline">
                {lead.phone}
              </a>
            ) : (
              <span className="text-subtle">–</span>
            )}
          </Field>
          <Field icon={Mail} label="E-post">
            {lead.email ? (
              <a href={`mailto:${lead.email}`} className="hover:underline">
                {lead.email}
              </a>
            ) : (
              <span className="text-subtle">–</span>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field icon={Wallet} label="Deal size">
              <span className="">{formatCurrency(lead.deal_size)}</span>
            </Field>
            <Field icon={CalendarClock} label="Oppfølging">
              <span className="">
                {lead.next_follow_up_at ? formatDate(lead.next_follow_up_at) : "–"}
              </span>
            </Field>
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-2 border-t border-line pt-3">
          <p className="eyebrow text-subtle">Sett status</p>
          <QuickStatus leadId={lead.id} current={lead.status} />
        </div>

        <Link
          href={`/leads/${lead.id}`}
          className={buttonVariants({ className: "w-full" })}
        >
          Åpne lead <ArrowRight />
        </Link>
      </CardContent>
    </Card>
  );
}
