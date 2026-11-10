"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Next weekday at the given hour, `days` days out (local time). */
function businessDay(days: number, hour = 9) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  if (d.getDay() === 6) d.setDate(d.getDate() + 2);
  else if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return d;
}

function nextMonday(hour = 9) {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  d.setHours(hour, 0, 0, 0);
  return d;
}

/** ISO → value for <input type="datetime-local"> in local time. */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatFollowUp(iso: string) {
  return new Date(iso).toLocaleString("nb-NO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * When to call back, with one-tap presets and an exact date/time.
 * `value`: undefined = automatic (the outcome's own rule), null = none, ISO = that time.
 */
export function FollowUpPicker({
  value,
  onChange,
  allowAuto = false,
  className,
}: {
  value: string | null | undefined;
  onChange: (v: string | null | undefined) => void;
  allowAuto?: boolean;
  className?: string;
}) {
  // Presets are computed once so render stays pure.
  const [presets] = useState(() => [
    { label: "I morgen 09:00", iso: businessDay(1).toISOString() },
    { label: "Om 2 dager", iso: businessDay(2).toISOString() },
    { label: "Neste uke", iso: nextMonday().toISOString() },
  ]);
  const presetHit = presets.find((p) => p.iso === value);

  const chip = (active: boolean) =>
    cn(
      "rounded-full border px-2.5 py-1 text-xs transition-colors",
      active ? "border-brand/50 bg-brand-soft text-brand" : "border-line text-muted hover:border-line-strong hover:text-fg"
    );

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {allowAuto && (
        <button type="button" className={chip(value === undefined)} onClick={() => onChange(undefined)}>
          Automatisk
        </button>
      )}
      {presets.map((p) => (
        <button key={p.label} type="button" className={chip(value === p.iso)} onClick={() => onChange(p.iso)}>
          {p.label}
        </button>
      ))}
      <input
        type="datetime-local"
        aria-label="Velg dato og klokkeslett"
        value={value && !presetHit ? toLocalInput(value) : ""}
        onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : undefined)}
        className={cn(
          "h-7 rounded-full border bg-transparent px-2.5 text-xs text-muted outline-none transition-colors focus:border-brand",
          value && !presetHit ? "border-brand/50 text-brand" : "border-line hover:border-line-strong"
        )}
      />
      {!allowAuto && (
        <button type="button" className={chip(value === null)} onClick={() => onChange(null)}>
          Ingen
        </button>
      )}
    </div>
  );
}
