"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Phone, Mail, Globe, ArrowUpRight, CalendarClock, PhoneCall } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { LeadNicheSelect } from "@/components/admin/lead-niche-select";
import { LeadAssignSelect } from "@/components/admin/lead-assign-select";
import { getLeadPreview, type LeadPreview } from "@/lib/actions/lead-review";
import { LEAD_STATUS_LABELS, CALL_OUTCOME_LABELS } from "@/lib/types";
import { LEAD_STATUS_VARIANT } from "@/lib/status-styles";
import { cn, formatCurrency, formatPhoneParts, relativeAge } from "@/lib/utils";
import type { CallOutcomeKey, Lead, Niche, Profile } from "@/lib/types";

type Seller = Pick<Profile, "id" | "full_name" | "email" | "role">;

export const OUTCOME_STYLE: Record<CallOutcomeKey, { dot: string; text: string }> = {
  no_answer: { dot: "bg-subtle", text: "text-muted" },
  voicemail: { dot: "bg-info", text: "text-info" },
  interested: { dot: "bg-warning", text: "text-warning" },
  meeting_booked: { dot: "bg-success", text: "text-success" },
  not_interested: { dot: "bg-danger", text: "text-danger" },
};

/** Last call outcome + age, e.g. «● Ikke svar · 3 d». */
export function LastCall({ lead, now }: { lead: Lead; now: number }) {
  if (!lead.last_call_outcome || !lead.last_call_at) {
    return <span className="text-xs text-subtle">Aldri ringt</span>;
  }
  const st = OUTCOME_STYLE[lead.last_call_outcome] ?? OUTCOME_STYLE.no_answer;
  return (
    <span className="flex items-center gap-2 whitespace-nowrap text-[13px]">
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", st.dot)} />
      <span className={st.text}>{CALL_OUTCOME_LABELS[lead.last_call_outcome]}</span>
      <span className="text-subtle">· {relativeAge(lead.last_call_at, now)}</span>
    </span>
  );
}

/** Right-hand panel: look a lead over without leaving the list. */
export function LeadPanel({
  leadId,
  niches,
  sellers,
  onClose,
  ringHref,
}: {
  leadId: string;
  /** Admin only: editable niche/seller. Omit for sellers. */
  niches?: Niche[];
  sellers?: Seller[];
  onClose: () => void;
  /** Shows «Ring herfra» into call mode starting at this lead. */
  ringHref?: string;
}) {
  const [data, setData] = useState<LeadPreview | null | undefined>(undefined);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    getLeadPreview(leadId).then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, [leadId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const lead = data?.lead;
  const phone = formatPhoneParts(lead?.phone);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Lead-detaljer">
      <button type="button" aria-label="Lukk" onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      <aside className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-line bg-surface shadow-2xl shadow-black">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <p className="eyebrow">Lead</p>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-subtle hover:bg-surface-2 hover:text-fg" aria-label="Lukk">
            <X className="h-4 w-4" />
          </button>
        </div>

        {data === undefined ? (
          <div className="flex flex-col gap-3 p-5">
            <div className="h-10 w-3/4 animate-pulse rounded-md bg-surface-2" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-surface-2" />
            <div className="mt-4 h-24 animate-pulse rounded-xl bg-surface-2" />
          </div>
        ) : !lead ? (
          <p className="p-5 text-sm text-muted">Fant ikke leadet.</p>
        ) : (
          <div className="flex flex-col gap-6 p-5">
            <div>
              <p className="display text-4xl text-fg">{lead.company_name ?? "Ukjent firma"}</p>
              <p className="mt-2 text-sm text-muted">
                {[lead.contact_name, lead.job_title].filter(Boolean).join(" · ") || "Ukjent kontaktperson"}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge variant={LEAD_STATUS_VARIANT[lead.status]}>{LEAD_STATUS_LABELS[lead.status]}</Badge>
                {lead.deal_size != null && <Badge>{formatCurrency(lead.deal_size)}</Badge>}
                {lead.city && <Badge>{lead.city}</Badge>}
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-line bg-bg p-4 text-sm">
              {lead.phone ? (
                <p className="flex items-center gap-2.5">
                  <Phone className="h-4 w-4 text-subtle" />
                  {phone.prefix && <span className="text-subtle">{phone.prefix}</span>}
                  <span className="display text-2xl tracking-wide text-fg">{phone.number}</span>
                </p>
              ) : (
                <p className="flex items-center gap-2.5 text-subtle">
                  <Phone className="h-4 w-4" /> Ingen telefon
                </p>
              )}
              {lead.email && (
                <a href={`mailto:${lead.email}`} className="flex items-center gap-2.5 text-fg-2 hover:text-fg">
                  <Mail className="h-4 w-4 text-subtle" /> {lead.email}
                </a>
              )}
              {lead.website && (
                <a
                  href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2.5 text-fg-2 hover:text-fg"
                >
                  <Globe className="h-4 w-4 text-subtle" /> {lead.website}
                </a>
              )}
            </div>

            <dl className="grid grid-cols-[110px_1fr] items-center gap-x-3 gap-y-2.5 text-sm">
              <dt className="text-subtle">Siste samtale</dt>
              <dd>
                <LastCall lead={lead} now={now} />
              </dd>
              <dt className="text-subtle">Oppfølging</dt>
              <dd className="flex items-center gap-2 text-fg-2">
                <CalendarClock className="h-3.5 w-3.5 text-subtle" />
                {lead.next_follow_up_at
                  ? new Date(lead.next_follow_up_at).toLocaleDateString("nb-NO", { day: "numeric", month: "short" })
                  : "Ingen satt"}
              </dd>
              {sellers ? (
                <>
                  <dt className="text-subtle">Selger</dt>
                  <dd>
                    <LeadAssignSelect leadId={lead.id} assignedTo={lead.assigned_to} sellers={sellers} className="h-8 w-full" />
                  </dd>
                </>
              ) : null}
              {niches ? (
                <>
                  <dt className="text-subtle">Nisje</dt>
                  <dd>
                    <LeadNicheSelect leadId={lead.id} nicheId={lead.niche_id} niches={niches} className="h-8 w-full" />
                  </dd>
                </>
              ) : (
                <>
                  <dt className="text-subtle">Nisje</dt>
                  <dd className="text-fg-2">{lead.niche?.name ?? "–"}</dd>
                </>
              )}
            </dl>

            <div className="flex flex-col gap-3">
              <p className="eyebrow">Historikk</p>
              {data.activities.length === 0 ? (
                <p className="text-sm text-subtle">Ingen aktivitet ennå.</p>
              ) : (
                <ol className="relative flex flex-col gap-4 border-l border-line pl-4">
                  {data.activities.map((a) => (
                    <li key={a.id} className="relative">
                      <span
                        className={cn(
                          "absolute -left-[21px] top-1.5 h-2 w-2 rounded-full ring-4 ring-surface",
                          a.type === "call" ? "bg-brand" : a.type === "note" ? "bg-info" : "bg-subtle"
                        )}
                      />
                      <p className="text-sm text-fg-2">{a.content}</p>
                      <p className="mt-0.5 text-xs text-subtle">
                        {new Date(a.created_at).toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric" })}
                        {a.seller && ` · ${a.seller}`}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {ringHref && lead.phone && (
                <Link href={ringHref} className={buttonVariants({ className: "w-full" })}>
                  <PhoneCall /> Ring herfra
                </Link>
              )}
              <Link href={`/leads/${lead.id}`} className={buttonVariants({ variant: "outline", className: "w-full" })}>
                Åpne hele leadet <ArrowUpRight />
              </Link>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

