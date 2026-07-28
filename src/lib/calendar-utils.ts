export const WEEKDAY_LABELS = ["MAN", "TIR", "ONS", "TOR", "FRE", "LØR", "SØN"];
export const CALENDAR_START_HOUR = 8;
export const CALENDAR_END_HOUR = 19;
/**
 * Row height is sized so a 30-minute meeting still fits its title + time
 * without clipping (2 lines x 13px + 8px padding = 34px, and 0.5 * 80 - 4 = 36px).
 */
export const CALENDAR_ROW_HEIGHT = 80;
export const MIN_MEETING_HEIGHT = 34;

export function getMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function formatDayNumber(date: Date) {
  return date.getDate().toString().padStart(2, "0");
}

export function formatWeekRange(monday: Date) {
  const sunday = addDays(monday, 6);
  const sameMonth = monday.getMonth() === sunday.getMonth();
  const fmt = (d: Date, withMonth: boolean) =>
    withMonth
      ? d.toLocaleDateString("nb-NO", { day: "numeric", month: "short" })
      : d.toLocaleDateString("nb-NO", { day: "numeric" });
  return `${fmt(monday, !sameMonth)} – ${fmt(sunday, true)} ${sunday.getFullYear()}`;
}

/** Decimal hour offset from midnight, e.g. 13:30 -> 13.5 */
export function hourDecimal(date: Date) {
  return date.getHours() + date.getMinutes() / 60;
}

export function formatHourLabel(hour: number) {
  if (hour === 12) return "12:00";
  return `${hour.toString().padStart(2, "0")}:00`;
}

export function formatTimeRange(startsAt: string, endsAt: string) {
  const opts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  const start = new Date(startsAt).toLocaleTimeString("nb-NO", opts);
  const end = new Date(endsAt).toLocaleTimeString("nb-NO", opts);
  return `${start}–${end}`;
}
