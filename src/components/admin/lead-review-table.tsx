"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, Phone, Mail, Globe, ArrowUpRight, Sparkles, Users, Tag, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { LeadNicheSelect } from "@/components/admin/lead-niche-select";
import { LeadAssignSelect } from "@/components/admin/lead-assign-select";
import { bulkAssignLeads, distributeLeadsEvenly } from "@/lib/actions/admin";
import { bulkSetNiche, autoClassifyNiches, getLeadPreview, type LeadPreview } from "@/lib/actions/lead-review";
import { LEAD_STATUS_LABELS, CALL_OUTCOME_LABELS } from "@/lib/types";
import { LEAD_STATUS_VARIANT } from "@/lib/status-styles";
import { avatarToneFor, initialsFor } from "@/lib/avatar-color";
import { cn, formatCurrency, formatPhoneParts, relativeAge } from "@/lib/utils";
import type { CallOutcomeKey, Lead, Niche, Profile } from "@/lib/types";

type Seller = Pick<Profile, "id" | "full_name" | "email" | "role">;

// Quiet in-table select: reads like text until you hover it.
const QUIET_SELECT =
  "h-8 w-auto max-w-44 cursor-pointer appearance-none truncate border-transparent bg-transparent px-2 text-[13px] text-fg-2 hover:border-line hover:bg-surface-2 focus-visible:border-brand";

export const OUTCOME_STYLE: Record<CallOutcomeKey, { dot: string; text: string }> = {
  no_answer: { dot: "bg-subtle", text: "text-muted" },
  voicemail: { dot: "bg-info", text: "text-info" },
  interested: { dot: "bg-warning", text: "text-warning" },
  meeting_booked: { dot: "bg-success", text: "text-success" },
  not_interested: { dot: "bg-danger", text: "text-danger" },
};

function Checkbox({
  checked,
  onChange,
  label,
  indeterminate,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  indeterminate?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
        checked || indeterminate ? "border-brand bg-brand text-brand-fg" : "border-line-strong hover:border-muted"
      )}
    >
      {indeterminate ? (
        <span className="h-0.5 w-2 rounded bg-brand-fg" />
      ) : checked ? (
        <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
          <path d="M2.5 6.5l2.2 2.2 4.8-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ) : null}
    </button>
  );
}

function LastCall({ lead, now }: { lead: Lead; now: number }) {
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
function LeadPanel({
  leadId,
  niches,
  sellers,
  onClose,
}: {
  leadId: string;
  niches: Niche[];
  sellers: Seller[];
  onClose: () => void;
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
              <dt className="text-subtle">Selger</dt>
              <dd>
                <LeadAssignSelect leadId={lead.id} assignedTo={lead.assigned_to} sellers={sellers} className="h-8 w-full" />
              </dd>
              <dt className="text-subtle">Nisje</dt>
              <dd>
                <LeadNicheSelect leadId={lead.id} nicheId={lead.niche_id} niches={niches} className="h-8 w-full" />
              </dd>
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

            <Link href={`/leads/${lead.id}`} className={buttonVariants({ variant: "outline", className: "w-full" })}>
              Åpne hele leadet <ArrowUpRight />
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}

/**
 * The admin lead list: compact rows that answer "what happened last, and when?",
 * a side panel per lead, and a floating bulk bar for assigning and sorting niche.
 */
export function LeadReviewTable({
  leads,
  niches,
  sellers,
  workload = {},
  total,
}: {
  leads: Lead[];
  niches: Niche[];
  sellers: Seller[];
  /** sellerId -> number of open leads they currently hold */
  workload?: Record<string, number>;
  total?: number;
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [sellerId, setSellerId] = useState("");
  const [nicheId, setNicheId] = useState("");
  const [showDistribute, setShowDistribute] = useState(false);
  const [distributeTo, setDistributeTo] = useState<Set<string>>(
    () => new Set(sellers.filter((s) => s.role === "seller").map((s) => s.id))
  );
  const [isPending, startTransition] = useTransition();
  const [now] = useState(() => Date.now());

  // After a CSV import, the import panel stashes the new lead ids and refreshes;
  // pick them up here and pre-select them so the admin can distribute right away.
  useEffect(() => {
    const raw = window.sessionStorage.getItem("importedLeadIds");
    if (!raw) return;
    window.sessionStorage.removeItem("importedLeadIds");
    try {
      const ids = JSON.parse(raw) as string[];
      const present = new Set(leads.map((l) => l.id));
      const toSelect = ids.filter((id) => present.has(id));
      // One-time handoff from sessionStorage (key cleared above).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (toSelect.length) setSelectedIds(new Set(toSelect));
    } catch {
      // ignore malformed handoff
    }
  }, [leads]);

  const allSelected = leads.length > 0 && selectedIds.size === leads.length;
  const someSelected = selectedIds.size > 0 && !allSelected;
  const sellerName = (id: string | null) => {
    const s = sellers.find((x) => x.id === id);
    return s ? s.full_name ?? s.email : null;
  };

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function run(fn: () => Promise<string | { error: string }>) {
    setMessage(null);
    startTransition(async () => {
      const res = await fn();
      if (typeof res === "string") {
        setMessage({ text: res });
        setSelectedIds(new Set());
        setShowDistribute(false);
        router.refresh();
      } else setMessage({ text: res.error, error: true });
    });
  }

  const ids = () => [...selectedIds];
  const skipNote = (n?: number) => (n ? ` ${n} hoppet over (selskap alt ringt).` : "");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <p className="text-sm text-muted">
          <span className="font-medium text-fg">{total != null && total > leads.length ? `${leads.length} av ${total}` : leads.length}</span> leads
        </p>
        {message && (
          <p className={cn("text-sm", message.error ? "text-danger" : "text-success")}>{message.text}</p>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] font-medium uppercase tracking-wider text-subtle">
              <th className="w-10 py-2.5 pl-4 pr-2">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={() => setSelectedIds(allSelected ? new Set() : new Set(leads.map((l) => l.id)))}
                  label={allSelected ? "Fjern alle valg" : "Velg alle på siden"}
                />
              </th>
              <th className="py-2.5 pr-4">Firma</th>
              <th className="py-2.5 pr-4">Telefon</th>
              <th className="py-2.5 pr-4">Siste samtale</th>
              <th className="py-2.5 pr-4">Status</th>
              <th className="py-2.5 pr-2">Selger</th>
              <th className="py-2.5 pr-2">Nisje</th>
              <th className="py-2.5 pr-4 text-right">Inn</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const checked = selectedIds.has(lead.id);
              const name = sellerName(lead.assigned_to);
              return (
                <tr
                  key={lead.id}
                  className={cn(
                    "group border-b border-line last:border-0 transition-colors",
                    checked ? "bg-brand-soft" : "hover:bg-surface-2/60"
                  )}
                >
                  <td className="py-2 pl-4 pr-2">
                    <Checkbox checked={checked} onChange={() => toggleOne(lead.id)} label={`Velg ${lead.company_name ?? "lead"}`} />
                  </td>
                  <td className="max-w-72 py-2 pr-4">
                    <button type="button" onClick={() => setOpenId(lead.id)} className="block max-w-full text-left">
                      <span className="block truncate font-medium text-fg group-hover:underline">
                        {lead.company_name ?? "Ukjent firma"}
                      </span>
                      <span className="block truncate text-xs text-subtle">
                        {[lead.contact_name, lead.job_title].filter(Boolean).join(" · ") || "–"}
                      </span>
                    </button>
                  </td>
                  <td className="whitespace-nowrap py-2 pr-4 text-[13px] text-fg-2">
                    {lead.phone ? formatPhoneParts(lead.phone).number : <span className="text-subtle">–</span>}
                  </td>
                  <td className="py-2 pr-4">
                    <LastCall lead={lead} now={now} />
                  </td>
                  <td className="py-2 pr-4">
                    <Badge variant={LEAD_STATUS_VARIANT[lead.status]}>{LEAD_STATUS_LABELS[lead.status]}</Badge>
                  </td>
                  <td className="py-1 pr-2">
                    <div className="flex items-center gap-1">
                      {name && (
                        <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold", avatarToneFor(lead.assigned_to!))}>
                          {initialsFor(name)}
                        </span>
                      )}
                      <LeadAssignSelect
                        key={`${lead.id}-${lead.assigned_to}`}
                        leadId={lead.id}
                        assignedTo={lead.assigned_to}
                        sellers={sellers}
                        className={cn(QUIET_SELECT, !name && "text-subtle")}
                      />
                    </div>
                  </td>
                  <td className="py-1 pr-2">
                    <LeadNicheSelect
                      key={`${lead.id}-${lead.niche_id}`}
                      leadId={lead.id}
                      nicheId={lead.niche_id}
                      niches={niches}
                      className={cn(QUIET_SELECT, !lead.niche_id && "text-subtle")}
                    />
                  </td>
                  <td className="whitespace-nowrap py-2 pr-4 text-right text-xs text-subtle">
                    {relativeAge(lead.created_at, now)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!leads.length && <p className="py-10 text-center text-sm text-muted">Ingen leads matcher filteret.</p>}
      </div>

      {/* Floating bulk bar – appears when something is selected. */}
      {selectedIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 lg:bottom-6 lg:left-60">
          <div className="flex max-w-full flex-col gap-3 rounded-2xl border border-line-strong bg-surface-2/95 p-3 shadow-2xl shadow-black/70 backdrop-blur-md">
            {showDistribute && (
              <div className="flex flex-wrap items-center gap-2 border-b border-line pb-3">
                <span className="text-xs text-subtle">Fordel jevnt til:</span>
                {sellers.map((s) => (
                  <label
                    key={s.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                      distributeTo.has(s.id) ? "border-brand/50 bg-brand-soft text-brand" : "border-line text-muted hover:text-fg"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={distributeTo.has(s.id)}
                      onChange={() =>
                        setDistributeTo((prev) => {
                          const next = new Set(prev);
                          if (next.has(s.id)) next.delete(s.id);
                          else next.add(s.id);
                          return next;
                        })
                      }
                    />
                    {(s.full_name ?? s.email).split(" ")[0]}
                    <span className="opacity-60">{workload[s.id] ?? 0}</span>
                  </label>
                ))}
                <Button
                  type="button"
                  size="sm"
                  disabled={isPending || distributeTo.size === 0}
                  onClick={() =>
                    run(async () => {
                      const recipients = sellers.filter((s) => distributeTo.has(s.id)).map((s) => s.id);
                      const r = await distributeLeadsEvenly(ids(), recipients);
                      return r.error ? { error: r.error } : `${r.assigned} leads fordelt jevnt på ${recipients.length}.${skipNote(r.skippedCalled)}`;
                    })
                  }
                >
                  Fordel {selectedIds.size}
                </Button>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-2 pr-1 text-sm font-medium text-fg">
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-bold text-brand-fg">
                  {selectedIds.size}
                </span>
                valgt
              </span>
              <span className="h-5 w-px bg-line" />
              <Select aria-label="Tildel til" value={sellerId} onChange={(e) => setSellerId(e.target.value)} className="h-8 w-auto text-[13px]">
                <option value="">Tildel til…</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name ?? s.email} ({workload[s.id] ?? 0})
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPending || !sellerId}
                onClick={() =>
                  run(async () => {
                    const r = await bulkAssignLeads(ids(), sellerId);
                    setSellerId("");
                    return r.error ? { error: r.error } : `${r.assigned} leads tildelt ${sellerName(sellerId)}.${skipNote(r.skippedCalled)}`;
                  })
                }
              >
                <Users /> Tildel
              </Button>
              <Button type="button" size="sm" variant={showDistribute ? "default" : "outline"} onClick={() => setShowDistribute((v) => !v)}>
                Fordel jevnt…
              </Button>
              <span className="h-5 w-px bg-line" />
              <Select aria-label="Sett nisje" value={nicheId} onChange={(e) => setNicheId(e.target.value)} className="h-8 w-auto text-[13px]">
                <option value="">Sett nisje…</option>
                {niches.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPending || !nicheId}
                onClick={() =>
                  run(async () => {
                    const r = await bulkSetNiche(ids(), nicheId);
                    setNicheId("");
                    return r.error ? { error: r.error } : `Nisje satt på ${r.updated} leads.`;
                  })
                }
              >
                <Tag /> Sett
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPending}
                title="Sett nisje automatisk ut fra firmanavn, bransje og nettside der det er tydelig"
                onClick={() =>
                  run(async () => {
                    const r = await autoClassifyNiches(ids());
                    return r.error ? { error: r.error } : `Auto-sortert: ${r.classified} av ${r.checked} uten nisje fikk nisje.`;
                  })
                }
              >
                <Sparkles /> Auto-sorter
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={() =>
                  run(async () => {
                    const r = await bulkAssignLeads(ids(), null);
                    return r.error ? { error: r.error } : `${r.assigned} leads lagt tilbake i poolen.`;
                  })
                }
              >
                Fjern tildeling
              </Button>
              <button
                type="button"
                aria-label="Fjern valg"
                onClick={() => {
                  setSelectedIds(new Set());
                  setShowDistribute(false);
                }}
                className="rounded-md p-1.5 text-subtle hover:bg-surface-3 hover:text-fg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {openId && <LeadPanel leadId={openId} niches={niches} sellers={sellers} onClose={() => setOpenId(null)} />}
    </div>
  );
}
