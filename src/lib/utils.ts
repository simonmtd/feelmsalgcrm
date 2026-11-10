import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return "–";
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "–";
  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "–";
  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

/**
 * A phone number split into an optional country prefix and digits grouped the
 * Norwegian way ("920 27 788"), for reading off the screen while dialling.
 */
export function formatPhoneParts(raw: string | null | undefined): { prefix: string | null; number: string } {
  const cleaned = (raw ?? "").replace(/[^\d+]/g, "");
  let prefix: string | null = null;
  let digits = cleaned;
  if (digits.startsWith("+47")) {
    prefix = "+47";
    digits = digits.slice(3);
  } else if (digits.startsWith("0047")) {
    prefix = "+47";
    digits = digits.slice(4);
  } else if (digits.startsWith("+")) {
    return { prefix: null, number: raw ?? "" };
  }
  if (digits.length !== 8) return { prefix, number: digits || (raw ?? "") };
  // Mobiles (4/9) read as 3-2-3, landlines as 2-2-2-2.
  const number = /^[49]/.test(digits)
    ? `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`
    : `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6)}`;
  return { prefix, number };
}

/** "i dag", "i går", "3 d", "5 uker", "4 mnd" – compact age for tables. */
export function relativeAge(iso: string | null | undefined, now: number): string {
  if (!iso) return "–";
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "i dag";
  if (days === 1) return "i går";
  if (days < 14) return `${days} d`;
  if (days < 60) return `${Math.round(days / 7)} uker`;
  return `${Math.round(days / 30)} mnd`;
}
