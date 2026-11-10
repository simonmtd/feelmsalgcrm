"use client";

import { useState } from "react";
import Link from "next/link";
import { PhoneCall } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LeadPanel, LastCall } from "@/components/leads/lead-panel";
import { LEAD_STATUS_LABELS } from "@/lib/types";
import { LEAD_STATUS_VARIANT } from "@/lib/status-styles";
import { cn, formatCurrency, formatPhoneParts } from "@/lib/utils";
import type { Lead } from "@/lib/types";

function followUpCell(iso: string | null, now: number) {
  if (!iso) return { text: "–", tone: "text-subtle" };
  const d = new Date(iso);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const days = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  const time = d.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
  if (d.getTime() < now) return { text: days === 0 ? `I dag ${time}` : `Forfalt ${-days} d`, tone: "text-danger" };
  if (days === 0) return { text: `I dag ${time}`, tone: "text-warning" };
  if (days === 1) return { text: `I morgen ${time}`, tone: "text-fg-2" };
  return { text: d.toLocaleDateString("nb-NO", { weekday: "short", day: "numeric", month: "short" }), tone: "text-muted" };
}

/**
 * A seller's leads as a compact table: last call and next follow-up on every
 * row, «Ring herfra» on hover, and the side panel on click.
 */
export function MyLeadsTable({ leads, ringBase }: { leads: Lead[]; ringBase: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const ringHref = (id: string) => `${ringBase}${ringBase.includes("?") ? "&" : "?"}start=${id}`;

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] font-medium uppercase tracking-wider text-subtle">
              <th className="py-2.5 pl-4 pr-4">Firma</th>
              <th className="py-2.5 pr-4">Telefon</th>
              <th className="py-2.5 pr-4">Siste samtale</th>
              <th className="py-2.5 pr-4">Neste oppfølging</th>
              <th className="py-2.5 pr-4">Status</th>
              <th className="py-2.5 pr-4 text-right">Verdi</th>
              <th className="w-32 py-2.5 pr-4" />
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const fu = lead.status === "won" || lead.status === "lost" ? null : followUpCell(lead.next_follow_up_at, now);
              return (
                <tr key={lead.id} className="group border-b border-line transition-colors last:border-0 hover:bg-surface-2/60">
                  <td className="max-w-72 py-2.5 pl-4 pr-4">
                    <button type="button" onClick={() => setOpenId(lead.id)} className="block max-w-full text-left">
                      <span className="block truncate font-medium text-fg group-hover:underline">
                        {lead.company_name ?? "Ukjent firma"}
                      </span>
                      <span className="block truncate text-xs text-subtle">
                        {[lead.contact_name, lead.niche?.name].filter(Boolean).join(" · ") || "–"}
                      </span>
                    </button>
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-4 text-[13px] text-fg-2">
                    {lead.phone ? formatPhoneParts(lead.phone).number : <span className="text-subtle">–</span>}
                  </td>
                  <td className="py-2.5 pr-4">
                    <LastCall lead={lead} now={now} />
                  </td>
                  <td className={cn("whitespace-nowrap py-2.5 pr-4 text-[13px]", fu?.tone ?? "text-subtle")}>{fu?.text ?? "–"}</td>
                  <td className="py-2.5 pr-4">
                    <Badge variant={LEAD_STATUS_VARIANT[lead.status]}>{LEAD_STATUS_LABELS[lead.status]}</Badge>
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-4 text-right text-[13px] text-fg-2">
                    {lead.deal_size != null ? formatCurrency(lead.deal_size) : <span className="text-subtle">–</span>}
                  </td>
                  <td className="py-2.5 pr-4 text-right">
                    {lead.phone && lead.status !== "won" && lead.status !== "lost" && (
                      <Link
                        href={ringHref(lead.id)}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium text-brand opacity-0 transition-opacity hover:bg-brand-soft focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <PhoneCall className="h-3.5 w-3.5" /> Ring herfra
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {openId && <LeadPanel leadId={openId} ringHref={ringHref(openId)} onClose={() => setOpenId(null)} />}
    </>
  );
}
