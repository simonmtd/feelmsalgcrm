/** Commission paid per approved (qualified) meeting, in NOK. */
export const COMMISSION_PER_MEETING = 500;

/** Minimum length of the note a seller must write to claim commission. */
export const COMMISSION_NOTE_MIN = 10;

const OSLO = "Europe/Oslo";

/** The calendar date (y, m, d) of an instant as seen in Norway. */
function osloDate(d: Date): { y: number; m: number; d: number } {
  const [y, m, day] = new Intl.DateTimeFormat("en-CA", { timeZone: OSLO })
    .format(d)
    .split("-")
    .map(Number);
  return { y, m, d: day };
}

export interface CommissionWeek {
  /** Sortable key, e.g. "2026-W45". */
  key: string;
  /** "Uke 45 · 2.–8. nov." */
  label: string;
}

/** ISO week (Monday–Sunday, Norwegian time) an instant falls in. */
export function commissionWeek(iso: string): CommissionWeek {
  const { y, m, d } = osloDate(new Date(iso));
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = (date.getUTCDay() + 6) % 7; // Monday = 0
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - dow);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  // ISO week number: the week containing that week's Thursday.
  const thursday = new Date(monday);
  thursday.setUTCDate(monday.getUTCDate() + 3);
  const weekYear = thursday.getUTCFullYear();
  const jan1 = Date.UTC(weekYear, 0, 1);
  const week = Math.floor((thursday.getTime() - jan1) / 86_400_000 / 7) + 1;

  const fmt = (x: Date, withMonth: boolean) =>
    x.toLocaleDateString("nb-NO", { timeZone: "UTC", day: "numeric", ...(withMonth ? { month: "short" } : {}) });
  const sameMonth = monday.getUTCMonth() === sunday.getUTCMonth();
  return {
    key: `${weekYear}-W${String(week).padStart(2, "0")}`,
    label: `Uke ${week} · ${fmt(monday, !sameMonth)}–${fmt(sunday, true)}`,
  };
}

/** "2026-11" month key (Norwegian time) of an instant. */
export function commissionMonth(iso: string): string {
  const { y, m } = osloDate(new Date(iso));
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** "november 2026" for a "2026-11" key. */
export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("nb-NO", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}
