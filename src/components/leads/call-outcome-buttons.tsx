"use client";

import { useState, useTransition } from "react";
import { Phone, PhoneOff, Voicemail, ThumbsUp, CalendarCheck, ThumbsDown } from "lucide-react";
import { logCallOutcome, type CallOutcome } from "@/lib/actions/leads";
import type { LucideIcon } from "lucide-react";

const OUTCOMES: [CallOutcome, string, LucideIcon][] = [
  ["no_answer", "Ikke svar", PhoneOff],
  ["voicemail", "Beskjed", Voicemail],
  ["interested", "Interessert", ThumbsUp],
  ["meeting_booked", "Møte", CalendarCheck],
  ["not_interested", "Ikke int.", ThumbsDown],
];

/** Compact "ring & registrer utfall" for a lead card — call and log an outcome
 *  without opening the lead. */
export function CallOutcomeButtons({
  leadId,
  phone,
}: {
  leadId: string;
  phone: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function register(outcome: CallOutcome, label: string) {
    setMsg(null);
    startTransition(async () => {
      await logCallOutcome(leadId, outcome);
      setMsg(`Registrert: ${label}`);
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      {phone ? (
        <a
          href={`tel:${phone}`}
          className="flex items-center justify-center gap-1.5 rounded-sm border-2 border-ink bg-forest-600 px-2 py-1.5 text-sm font-bold text-parchment shadow-[2px_2px_0_0_var(--color-ink)] transition-transform hover:-translate-y-0.5"
        >
          <Phone className="h-4 w-4" /> {phone}
        </a>
      ) : (
        <span className="flex items-center justify-center gap-1.5 rounded-sm border-2 border-dashed border-ink/40 px-2 py-1.5 text-xs text-wood-600">
          <PhoneOff className="h-3.5 w-3.5" /> Ingen telefon
        </span>
      )}
      <div className="flex flex-wrap gap-1">
        {OUTCOMES.map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            disabled={isPending}
            onClick={() => register(key, label)}
            className="flex items-center gap-1 rounded-sm border-2 border-ink bg-parchment px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink shadow-[1px_1px_0_0_var(--color-ink)] transition-colors hover:bg-gold-100 disabled:opacity-50"
          >
            <Icon className="h-3 w-3 shrink-0" /> {label}
          </button>
        ))}
      </div>
      {msg && <p className="text-[11px] text-forest-700">{msg}</p>}
    </div>
  );
}
