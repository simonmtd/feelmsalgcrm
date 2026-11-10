"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Pencil,
  Sparkles,
  PhoneOff,
  Voicemail,
  ThumbsDown,
  ThumbsUp,
  CalendarCheck,
  PhoneCall,
  Copy,
  Check,
  Mail,
  Globe,
  Link2,
  AlertTriangle,
} from "lucide-react";
import {
  updateLeadStatus,
  updateLeadFilmingStatus,
  updateLeadDetails,
  updateLeadContact,
  enrichLead,
  logCallOutcome,
  addLeadActivity,
} from "@/lib/actions/leads";
import type { CallOutcome } from "@/lib/actions/leads";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button, buttonVariants } from "@/components/ui/button";
import { segmented } from "@/components/ui/segmented";
import { FollowUpPicker, formatFollowUp } from "@/components/leads/follow-up-picker";
import { cn, formatCurrency, formatDateTime, formatPhoneParts, relativeAge } from "@/lib/utils";
import { LEAD_STATUS_LABELS, FILMING_STATUS_LABELS, ACTIVITY_TYPE_LABELS, CALL_OUTCOME_LABELS } from "@/lib/types";
import type { Lead, LeadActivity, ActivityType, LeadStatus, FilmingStatus } from "@/lib/types";
import type { LucideIcon } from "lucide-react";

const OUTCOMES: { key: CallOutcome; label: string; icon: LucideIcon; tone: string }[] = [
  { key: "no_answer", label: "Ikke svar", icon: PhoneOff, tone: "hover:border-line-strong" },
  { key: "voicemail", label: "La igjen beskjed", icon: Voicemail, tone: "hover:border-info/60 hover:text-info" },
  { key: "interested", label: "Interessert", icon: ThumbsUp, tone: "hover:border-warning/60 hover:text-warning" },
  { key: "meeting_booked", label: "Møte booket", icon: CalendarCheck, tone: "hover:border-success/60 hover:text-success" },
  { key: "not_interested", label: "Ikke interessert", icon: ThumbsDown, tone: "hover:border-danger/60 hover:text-danger" },
];

const STATUS_ACTIVE: Record<LeadStatus, string> = {
  new: "bg-info-soft text-info border-transparent",
  assigned: "bg-violet-soft text-violet border-transparent",
  contacted: "bg-warning-soft text-warning border-transparent",
  follow_up: "bg-warning-soft text-warning border-transparent",
  won: "bg-success-soft text-success border-transparent",
  lost: "bg-danger-soft text-danger border-transparent",
};

const ACTIVITY_DOT: Partial<Record<ActivityType, string>> = {
  call: "bg-brand",
  email: "bg-info",
  note: "bg-violet",
  status_change: "bg-subtle",
  filming_update: "bg-success",
};

const CONTACT_FIELDS = [
  ["company_name", "Firma"],
  ["contact_name", "Kontaktperson"],
  ["job_title", "Tittel"],
  ["phone", "Telefon"],
  ["email", "E-post"],
  ["website", "Nettside"],
  ["industry", "Bransje"],
] as const;

function pill(active: boolean, activeClass: string) {
  return cn(
    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-default",
    active ? activeClass : "border-line text-muted hover:border-line-strong hover:text-fg"
  );
}

export function LeadDetail({ lead, activities }: { lead: Lead; activities: LeadActivity[] }) {
  const [isPending, startTransition] = useTransition();
  const [now] = useState(() => Date.now());
  const [dealSize, setDealSize] = useState(lead.deal_size?.toString() ?? "");
  const [followUp, setFollowUp] = useState<string | null | undefined>(lead.next_follow_up_at ?? null);
  const [activityType, setActivityType] = useState<ActivityType>("call");
  const [note, setNote] = useState("");
  const [callNote, setCallNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const [editingContact, setEditingContact] = useState(false);
  const [enrichMsg, setEnrichMsg] = useState<string | null>(null);
  const [enriching, startEnrich] = useTransition();
  const initialContact = () => Object.fromEntries(CONTACT_FIELDS.map(([k]) => [k, lead[k] ?? ""])) as Record<(typeof CONTACT_FIELDS)[number][0], string>;
  const [contact, setContact] = useState(initialContact);

  const phone = formatPhoneParts(lead.phone);

  function registerOutcome(outcome: CallOutcome, label: string) {
    setFlash(null);
    startTransition(async () => {
      await logCallOutcome(lead.id, outcome, callNote);
      setCallNote("");
      setFlash(`Registrert: ${label}.`);
    });
  }

  async function copyPhone() {
    if (!lead.phone) return;
    try {
      await navigator.clipboard.writeText(lead.phone.replace(/\s/g, ""));
      setCopied(true);
    } catch {
      // clipboard blocked
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {lead.duplicate_of && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/40 bg-danger-soft p-3 text-sm font-medium text-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Dette er et duplikat – samme person finnes fra en annen kilde. Ikke ring denne.
          <Link href={`/leads/${lead.duplicate_of}`} className="ml-auto underline">
            Se originalen
          </Link>
        </div>
      )}

      {/* Hero */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="display text-5xl text-fg sm:text-6xl">{lead.company_name ?? "Ukjent firma"}</h2>
          <p className="mt-2 text-muted">
            {[lead.contact_name, lead.job_title].filter(Boolean).join(" · ") || "Ukjent kontaktperson"}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Badge className={STATUS_ACTIVE[lead.status]}>{LEAD_STATUS_LABELS[lead.status]}</Badge>
            {lead.niche && <Badge>{lead.niche.name}</Badge>}
            {lead.deal_size != null && <Badge>{formatCurrency(lead.deal_size)}</Badge>}
            {lead.last_call_outcome && lead.last_call_at && (
              <span className="ml-1 text-xs text-subtle">
                Sist ringt: {CALL_OUTCOME_LABELS[lead.last_call_outcome]} · {relativeAge(lead.last_call_at, now)}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {lead.phone && (
            <Link href={`/ring?start=${lead.id}`} className={buttonVariants()}>
              <PhoneCall /> Ring i ringemodus
            </Link>
          )}
          <Button type="button" variant="outline" disabled={enriching} onClick={() => startEnrich(async () => setEnrichMsg((await enrichLead(lead.id)).message))} title="Hent manglende telefon/e-post fra Apollo">
            <Sparkles /> {enriching ? "Beriker…" : "Berik"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setEditingContact((v) => !v)}>
            <Pencil /> {editingContact ? "Lukk" : "Rediger"}
          </Button>
        </div>
      </div>
      {enrichMsg && <p className="-mt-3 text-sm text-success">{enrichMsg}</p>}

      {editingContact && (
        <Card>
          <CardHeader>
            <CardTitle>Rediger kontaktinfo</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CONTACT_FIELDS.map(([key, label]) => (
              <div key={key} className="flex flex-col gap-1.5">
                <Label htmlFor={`c-${key}`}>{label}</Label>
                <Input id={`c-${key}`} value={contact[key]} onChange={(e) => setContact((c) => ({ ...c, [key]: e.target.value }))} />
              </div>
            ))}
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
              <Button
                type="button"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await updateLeadContact(lead.id, contact);
                    setEditingContact(false);
                  })
                }
              >
                {isPending ? "Lagrer…" : "Lagre"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => { setEditingContact(false); setContact(initialContact()); }}>
                Avbryt
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Call */}
          <Card>
            <CardContent className="flex flex-col gap-5 pt-5">
              {lead.phone ? (
                <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-bg px-5 py-4">
                  <a href={`tel:${lead.phone.replace(/\s/g, "")}`} className="flex items-baseline gap-3 hover:text-brand">
                    {phone.prefix && <span className="text-lg text-subtle">{phone.prefix}</span>}
                    <span className="display text-5xl tracking-wide">{phone.number}</span>
                  </a>
                  <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={copyPhone}>
                    {copied ? <Check /> : <Copy />} {copied ? "Kopiert" : "Kopier"}
                  </Button>
                </div>
              ) : (
                <p className="flex items-center gap-2 rounded-xl border border-dashed border-line-strong px-5 py-4 text-sm text-subtle">
                  <PhoneOff className="h-4 w-4" /> Ingen telefon – bruk «Berik» eller «Rediger».
                </p>
              )}
              <div className="flex flex-col gap-2">
                <p className="eyebrow">Hva skjedde?</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {OUTCOMES.map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      disabled={isPending}
                      onClick={() => registerOutcome(o.key, o.label)}
                      className={cn(
                        "flex flex-col items-start gap-2.5 rounded-xl border border-line bg-surface-2 p-3 text-left text-sm font-medium text-fg transition-colors disabled:opacity-50",
                        o.tone
                      )}
                    >
                      <o.icon className="h-4 w-4" />
                      {o.label}
                    </button>
                  ))}
                </div>
                <Textarea
                  value={callNote}
                  onChange={(e) => setCallNote(e.target.value)}
                  placeholder="Notat fra samtalen (valgfritt) – lagres sammen med utfallet"
                  className="min-h-14"
                />
                {flash && <p className="text-sm text-success">{flash}</p>}
              </div>
            </CardContent>
          </Card>

          {/* Activity */}
          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
              <CardTitle>Historikk</CardTitle>
              <div className={segmented.root}>
                {(["call", "email", "note"] as ActivityType[]).map((type) => (
                  <button key={type} type="button" className={segmented.item(activityType === type)} onClick={() => setActivityType(type)}>
                    {ACTIVITY_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Textarea placeholder="Hva ble sagt / avtalt?" value={note} onChange={(e) => setNote(e.target.value)} />
                <Button
                  size="sm"
                  className="self-end"
                  disabled={isPending || !note.trim()}
                  onClick={() =>
                    startTransition(async () => {
                      await addLeadActivity(lead.id, activityType, note);
                      setNote("");
                    })
                  }
                >
                  Legg til
                </Button>
              </div>
              {activities.length === 0 ? (
                <p className="text-sm text-subtle">Ingen aktivitet registrert ennå.</p>
              ) : (
                <ol className="relative flex flex-col gap-5 border-l border-line pl-5">
                  {activities.map((a) => (
                    <li key={a.id} className="relative">
                      <span className={cn("absolute -left-[25px] top-1.5 h-2 w-2 rounded-full ring-4 ring-surface", ACTIVITY_DOT[a.type] ?? "bg-subtle")} />
                      <p className="text-sm text-fg-2">{a.content}</p>
                      <p className="mt-1 text-xs text-subtle">
                        {ACTIVITY_TYPE_LABELS[a.type]} · {formatDateTime(a.created_at)}
                        {a.seller && ` · ${a.seller.full_name ?? a.seller.email}`}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(LEAD_STATUS_LABELS) as LeadStatus[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={isPending || s === lead.status}
                    onClick={() => startTransition(() => updateLeadStatus(lead.id, s))}
                    className={pill(s === lead.status, STATUS_ACTIVE[s])}
                  >
                    {LEAD_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <p className="eyebrow">Filming</p>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(FILMING_STATUS_LABELS) as FilmingStatus[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={isPending || s === lead.filming_status}
                      onClick={() => startTransition(() => updateLeadFilmingStatus(lead.id, s))}
                      className={pill(s === lead.filming_status, "border-brand/50 bg-brand-soft text-brand")}
                    >
                      {FILMING_STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Deal & follow-up */}
          <Card>
            <CardHeader>
              <CardTitle>Deal og oppfølging</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="deal_size">Deal size (NOK)</Label>
                <div className="flex gap-2">
                  <Input id="deal_size" type="number" min={0} value={dealSize} onChange={(e) => setDealSize(e.target.value)} />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9"
                    disabled={isPending}
                    onClick={() => startTransition(() => updateLeadDetails(lead.id, { deal_size: dealSize ? Number(dealSize) : null }))}
                  >
                    Lagre
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Neste oppfølging</Label>
                <p className="text-sm text-fg-2">
                  {lead.next_follow_up_at ? formatFollowUp(lead.next_follow_up_at) : "Ingen satt"}
                </p>
                <FollowUpPicker value={followUp} onChange={setFollowUp} />
                <Button
                  size="sm"
                  variant="outline"
                  className="self-start"
                  disabled={isPending || followUp === undefined || followUp === (lead.next_follow_up_at ?? null)}
                  onClick={() => startTransition(() => updateLeadDetails(lead.id, { next_follow_up_at: followUp ?? null }))}
                >
                  Lagre oppfølging
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle>Detaljer</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-2.5 text-sm">
                {lead.email && (
                  <>
                    <dt className="text-subtle">E-post</dt>
                    <dd className="min-w-0">
                      <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 truncate text-fg-2 hover:text-fg">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-subtle" /> {lead.email}
                      </a>
                    </dd>
                  </>
                )}
                {lead.website && (
                  <>
                    <dt className="text-subtle">Nettside</dt>
                    <dd className="min-w-0">
                      <a
                        href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 truncate text-fg-2 hover:text-fg"
                      >
                        <Globe className="h-3.5 w-3.5 shrink-0 text-subtle" /> {lead.website}
                      </a>
                    </dd>
                  </>
                )}
                {lead.linkedin_url && /^https?:\/\//i.test(lead.linkedin_url) && (
                  <>
                    <dt className="text-subtle">LinkedIn</dt>
                    <dd className="min-w-0">
                      <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 truncate text-fg-2 hover:text-fg">
                        <Link2 className="h-3.5 w-3.5 shrink-0 text-subtle" /> Profil
                      </a>
                    </dd>
                  </>
                )}
                <dt className="text-subtle">Bransje</dt>
                <dd className="text-fg-2">{lead.industry ?? "–"}</dd>
                {(lead.city || lead.country) && (
                  <>
                    <dt className="text-subtle">Sted</dt>
                    <dd className="text-fg-2">{[lead.city, lead.country].filter(Boolean).join(", ")}</dd>
                  </>
                )}
                {lead.employee_count != null && (
                  <>
                    <dt className="text-subtle">Ansatte</dt>
                    <dd className="text-fg-2">{lead.employee_count}</dd>
                  </>
                )}
                <dt className="text-subtle">Org.nr</dt>
                <dd className="text-fg-2">
                  {lead.org_number ? (
                    <a href={`https://virksomhet.brreg.no/nb/oppslag/enheter/${lead.org_number}`} target="_blank" rel="noopener noreferrer" className="hover:text-fg hover:underline">
                      {lead.org_number}
                    </a>
                  ) : (
                    "–"
                  )}
                </dd>
                <dt className="text-subtle">Kilde</dt>
                <dd className="text-fg-2 capitalize">{lead.source}</dd>
                <dt className="text-subtle">Tildelt</dt>
                <dd className="text-fg-2">{lead.assigned_date ?? "–"}</dd>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
