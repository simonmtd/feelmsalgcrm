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
          className="flex items-center justify-center gap-2 rounded-lg bg-success-soft px-2 py-2 text-sm font-semibold text-success transition-colors hover:bg-success/20"
        >
          <Phone className="h-4 w-4" /> {phone}
        </a>
      ) : (
        <span className="flex items-center justify-center gap-1.5 rounded-md border border-dashed border-line-strong px-2 py-1.5 text-xs text-subtle">
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
            className="flex items-center gap-1 rounded-full border border-line px-2 py-1 text-xs text-muted transition-colors hover:border-line-strong hover:text-fg disabled:opacity-50"
          >
            <Icon className="h-3 w-3 shrink-0" /> {label}
          </button>
        ))}
      </div>
      {msg && <p className="text-[11px] text-success">{msg}</p>}
    </div>
  );
}
