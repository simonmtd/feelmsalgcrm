"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  PhoneOff,
  Voicemail,
  ThumbsUp,
  CalendarCheck,
  ThumbsDown,
  Copy,
  Check,
  Mail,
  SkipForward,
  ArrowLeft,
  X,
  PartyPopper,
} from "lucide-react";
import { logCallOutcome, type CallOutcome } from "@/lib/actions/leads";
import { createMeeting } from "@/lib/actions/meetings";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PixelProgress } from "@/components/charts/pixel-progress";
import { COMMISSION_PER_MEETING } from "@/lib/commission";
import { cn, formatCurrency, formatPhoneParts } from "@/lib/utils";
import type { Lead } from "@/lib/types";
import type { LucideIcon } from "lucide-react";

export interface CallActivity {
  content: string;
  type: string;
  created_at: string;
}

const OUTCOMES: { key: CallOutcome; label: string; icon: LucideIcon; tone: string }[] = [
  { key: "no_answer", label: "Ikke svar", icon: PhoneOff, tone: "hover:border-line-strong" },
  { key: "voicemail", label: "La igjen beskjed", icon: Voicemail, tone: "hover:border-info/60 hover:text-info" },
  { key: "interested", label: "Interessert", icon: ThumbsUp, tone: "hover:border-warning/60 hover:text-warning" },
  { key: "meeting_booked", label: "Møte booket", icon: CalendarCheck, tone: "hover:border-success/60 hover:text-success" },
  { key: "not_interested", label: "Ikke interessert", icon: ThumbsDown, tone: "hover:border-danger/60 hover:text-danger" },
];

function ago(iso: string, now: number) {
  const mins = Math.round((now - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min siden`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} t siden`;
  const d = Math.round(h / 24);
  return d === 1 ? "i går" : `${d} dager siden`;
}

function isTyping(el: EventTarget | null) {
  return el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
}

/** Inline "book the meeting" step after "Møte booket", pre-filled from the call. */
function BookMeeting({ lead, note, onDone }: { lead: Lead; note: string; onDone: (booked: boolean) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("10:45");
  const [defaultDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });

  function onStart(v: string) {
    setStart(v);
    const [h, m] = v.split(":").map(Number);
    if (Number.isFinite(h) && Number.isFinite(m)) {
      const t = h * 60 + m + 45;
      setEnd(`${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      action={(fd) =>
        startTransition(async () => {
          const res = await createMeeting(undefined, fd);
          if (res.error) setError(res.error);
          else onDone(true);
        })
      }
    >
      <input type="hidden" name="lead_id" value={lead.id} />
      <input type="hidden" name="type" value="sales_meeting" />
      <div className="flex items-center gap-2 text-success">
        <CalendarCheck className="h-5 w-5" />
        <p className="font-semibold">Møte booket – legg det inn nå, så det ikke glemmes</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="cm-title">Tittel</Label>
          <Input id="cm-title" name="title" required defaultValue={`Salgsmøte: ${lead.company_name ?? lead.contact_name ?? ""}`} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cm-date">Dato</Label>
          <Input id="cm-date" name="date" type="date" required defaultValue={defaultDate} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cm-start">Start</Label>
            <Input id="cm-start" name="start_time" type="time" required value={start} onChange={(e) => onStart(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cm-end">Slutt</Label>
            <Input id="cm-end" name="end_time" type="time" required value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="cm-location">Sted</Label>
          <Input id="cm-location" name="location" placeholder="Teams, hos kunden …" />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="cm-notes">Notat</Label>
          <Textarea id="cm-notes" name="notes" defaultValue={note} placeholder="Hvem møter du, hva ble avtalt …" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-fg-2">
        <input type="checkbox" name="commission_claimed" defaultChecked className="h-4 w-4 accent-brand" />
        Provisjonsmøte – krev {formatCurrency(COMMISSION_PER_MEETING)}
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Lagrer …" : "Lagre møte og gå videre"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => onDone(false)}>
          Legg inn senere
        </Button>
      </div>
    </form>
  );
}

/**
 * Focused calling: one lead at a time, the number big enough to dial from your
 * phone, and one key (1–5) to log the outcome and jump to the next lead.
 * The queue is snapshotted on mount so leads don't shift while you work.
 */
export function CallMode({
  queue: initialQueue,
  activities,
  backHref,
}: {
  queue: Lead[];
  activities: Record<string, CallActivity[]>;
  backHref: string;
}) {
  const [queue] = useState(initialQueue);
  // Captured once so render stays pure; minute precision is plenty here.
  const [now] = useState(() => Date.now());
  const [index, setIndex] = useState(0);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [booking, setBooking] = useState<{ note: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Record<CallOutcome | "skipped", number>>({
    no_answer: 0,
    voicemail: 0,
    interested: 0,
    meeting_booked: 0,
    not_interested: 0,
    skipped: 0,
  });
  const [isPending, startTransition] = useTransition();
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const lead = queue[index] as Lead | undefined;
  const done = index >= queue.length;
  const calls = useMemo(
    () => Object.entries(stats).reduce((s, [k, v]) => (k === "skipped" ? s : s + v), 0),
    [stats]
  );

  const next = useCallback(() => {
    setNote("");
    setCopied(false);
    setBooking(null);
    setError(null);
    setIndex((i) => i + 1);
  }, []);

  const register = useCallback(
    (outcome: CallOutcome) => {
      if (!lead || isPending || booking) return;
      const text = note;
      setError(null);
      startTransition(async () => {
        try {
          await logCallOutcome(lead.id, outcome, text);
          setStats((s) => ({ ...s, [outcome]: s[outcome] + 1 }));
          if (outcome === "meeting_booked") setBooking({ note: text });
          else next();
        } catch {
          setError("Kunne ikke registrere samtalen. Prøv igjen.");
        }
      });
    },
    [lead, isPending, booking, note, next]
  );

  const skip = useCallback(() => {
    if (!lead || booking) return;
    setStats((s) => ({ ...s, skipped: s.skipped + 1 }));
    next();
  }, [lead, booking, next]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= OUTCOMES.length) {
        e.preventDefault();
        register(OUTCOMES[n - 1].key);
      } else if (e.key === "s" || e.key === "ArrowRight") {
        e.preventDefault();
        skip();
      } else if (e.key === "n") {
        e.preventDefault();
        noteRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [register, skip]);

  async function copyNumber() {
    if (!lead?.phone) return;
    try {
      await navigator.clipboard.writeText(lead.phone.replace(/\s/g, ""));
      setCopied(true);
    } catch {
      // clipboard blocked – the number is on screen anyway
    }
  }

  if (queue.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <PartyPopper className="h-8 w-8 text-brand" />
          <p className="display text-3xl text-fg">Ingen å ringe</p>
          <p className="max-w-md text-sm text-muted">
            Ingen åpne leads med telefonnummer som skal ringes i dag. Leads med oppfølging senere dukker opp igjen den dagen.
          </p>
          <Link href={backHref} className={buttonVariants({ variant: "outline", className: "mt-2" })}>
            <ArrowLeft /> Tilbake til leads
          </Link>
        </CardContent>
      </Card>
    );
  }

  const phone = formatPhoneParts(lead?.phone);
  const history = lead ? activities[lead.id] ?? [] : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <p className="shrink-0 text-sm text-muted">
            <span className="font-semibold text-fg">{Math.min(index + 1, queue.length)}</span> av {queue.length}
          </p>
          <PixelProgress percent={(index / queue.length) * 100} className="flex-1" />
          <Link href={backHref} className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <X /> Avslutt
          </Link>
        </div>

        {done || !lead ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <PartyPopper className="h-8 w-8 text-brand" />
              <p className="display text-4xl text-fg">Køen er tom!</p>
              <p className="text-sm text-muted">
                {calls} samtaler · {stats.meeting_booked} møter booket · {stats.interested} interesserte
              </p>
              <Link href={backHref} className={buttonVariants({ className: "mt-2" })}>
                Ferdig
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <CardContent className="flex flex-col gap-6 pt-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/leads/${lead.id}`} target="_blank" className="display block truncate text-4xl text-fg hover:text-brand sm:text-5xl">
                    {lead.company_name ?? "Ukjent firma"}
                  </Link>
                  <p className="mt-2 text-muted">
                    {[lead.contact_name, lead.job_title].filter(Boolean).join(" · ") || "Ukjent kontaktperson"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {lead.niche && <Badge>{lead.niche.name}</Badge>}
                  {lead.next_follow_up_at && new Date(lead.next_follow_up_at).getTime() < now && (
                    <Badge variant="red">Forfalt oppfølging</Badge>
                  )}
                  {(lead.status === "new" || lead.status === "assigned") && <Badge variant="blue">Ikke ringt før</Badge>}
                </div>
              </div>

              {/* The number, big and grouped so it's easy to key into a phone. */}
              <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-bg px-5 py-4">
                <p className="flex items-baseline gap-3">
                  {phone.prefix && <span className="text-lg text-subtle">{phone.prefix}</span>}
                  <span className="display text-5xl tracking-wide text-fg sm:text-6xl">{phone.number}</span>
                </p>
                <Button type="button" variant="outline" size="sm" onClick={copyNumber} className="ml-auto">
                  {copied ? <Check /> : <Copy />} {copied ? "Kopiert" : "Kopier"}
                </Button>
              </div>

              {lead.email && (
                <a href={`mailto:${lead.email}`} className="-mt-2 flex w-fit items-center gap-2 text-sm text-muted hover:text-fg">
                  <Mail className="h-4 w-4" /> {lead.email}
                </a>
              )}

              {booking ? (
                <BookMeeting
                  lead={lead}
                  note={booking.note}
                  onDone={() => next()}
                />
              ) : (
                <>
                  <div className="flex flex-col gap-2">
                    <p className="eyebrow">Hva skjedde?</p>
                    <div className="grid gap-2 sm:grid-cols-5">
                      {OUTCOMES.map((o, i) => (
                        <button
                          key={o.key}
                          type="button"
                          disabled={isPending}
                          onClick={() => register(o.key)}
                          className={cn(
                            "group flex flex-col items-start gap-3 rounded-xl border border-line bg-surface-2 p-3 text-left text-sm font-medium text-fg transition-colors disabled:opacity-50",
                            o.tone
                          )}
                        >
                          <span className="flex w-full items-center justify-between">
                            <o.icon className="h-4 w-4" />
                            <kbd className="rounded-md border border-line bg-bg px-1.5 text-[11px] text-subtle">{i + 1}</kbd>
                          </span>
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="call-note">Notat fra samtalen (valgfritt)</Label>
                    <Textarea
                      id="call-note"
                      ref={noteRef}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="F.eks. «Ring etter kl. 14», «sender tilbud fredag» …"
                    />
                  </div>
                  {error && <p className="text-sm text-danger">{error}</p>}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-subtle">
                    <span>
                      Tast <kbd className="rounded border border-line px-1">1</kbd>–<kbd className="rounded border border-line px-1">5</kbd> for utfall ·{" "}
                      <kbd className="rounded border border-line px-1">N</kbd> notat ·{" "}
                      <kbd className="rounded border border-line px-1">S</kbd> hopp over
                    </span>
                    <Button type="button" variant="ghost" size="sm" onClick={skip} disabled={isPending}>
                      Hopp over <SkipForward />
                    </Button>
                  </div>
                </>
              )}

              {history.length > 0 && (
                <div className="flex flex-col gap-2 border-t border-line pt-4">
                  <p className="eyebrow">Tidligere</p>
                  <ul className="flex flex-col gap-1.5">
                    {history.map((a, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <span className="w-28 shrink-0 text-subtle">{ago(a.created_at, now)}</span>
                        <span className="text-fg-2">{a.content}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <aside className="flex flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col gap-3 pt-5">
            <p className="eyebrow">Denne økta</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="display text-4xl text-fg">{calls}</p>
                <p className="text-xs text-muted">samtaler</p>
              </div>
              <div>
                <p className="display text-4xl text-brand">{stats.meeting_booked}</p>
                <p className="text-xs text-muted">møter booket</p>
              </div>
            </div>
            <ul className="flex flex-col gap-1 text-sm">
              {OUTCOMES.filter((o) => o.key !== "meeting_booked").map((o) => (
                <li key={o.key} className="flex justify-between text-muted">
                  <span>{o.label}</span>
                  <span className="text-fg">{stats[o.key]}</span>
                </li>
              ))}
              {stats.skipped > 0 && (
                <li className="flex justify-between text-subtle">
                  <span>Hoppet over</span>
                  <span>{stats.skipped}</span>
                </li>
              )}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-2 pt-5">
            <p className="eyebrow">Neste i køen</p>
            {queue.slice(index + 1, index + 8).map((l, i) => (
              <button
                key={l.id}
                type="button"
                disabled={!!booking}
                onClick={() => {
                  setStats((s) => ({ ...s, skipped: s.skipped + i + 1 }));
                  setNote("");
                  setError(null);
                  setIndex(index + 1 + i);
                }}
                className="flex flex-col rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-2 disabled:opacity-50"
              >
                <span className="truncate text-sm text-fg">{l.company_name ?? "Ukjent firma"}</span>
                <span className="truncate text-xs text-subtle">{l.contact_name ?? "–"}</span>
              </button>
            ))}
            {index + 1 >= queue.length && <p className="text-sm text-subtle">Siste i køen.</p>}
            {queue.length - index - 8 > 0 && (
              <p className="px-2 text-xs text-subtle">+ {queue.length - index - 8} til</p>
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
