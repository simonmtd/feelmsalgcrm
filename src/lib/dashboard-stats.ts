import type { Lead } from "@/lib/types";

const OPEN_STATUSES = new Set(["new", "assigned", "contacted", "follow_up"]);

export function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysAgo(n: number) {
  const d = startOfDay(new Date());
  d.setDate(d.getDate() - n);
  return d;
}

function inRange(lead: Lead, from: Date, to?: Date) {
  const created = startOfDay(new Date(lead.created_at));
  return created >= from && (!to || created <= to);
}

function bucketDaily(leads: Lead[], days: number, accessor: (l: Lead) => number = () => 1) {
  const buckets = Array.from({ length: days }, (_, i) => ({ date: daysAgo(days - 1 - i), value: 0 }));
  for (const lead of leads) {
    const created = startOfDay(new Date(lead.created_at)).getTime();
    const bucket = buckets.find((b) => b.date.getTime() === created);
    if (bucket) bucket.value += accessor(lead);
  }
  return buckets;
}

const WEEKDAYS = ["Sø", "Ma", "Ti", "On", "To", "Fr", "Lø"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Des"];

export function weekPoints(leads: Lead[]) {
  return bucketDaily(leads, 7).map((b) => ({ label: WEEKDAYS[b.date.getDay()], value: b.value }));
}

export function monthPoints(leads: Lead[]) {
  const weeks = 5;
  const points: { label: string; value: number }[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const start = daysAgo(w * 7 + 6);
    const end = daysAgo(w * 7);
    const count = leads.filter((l) => inRange(l, start, end)).length;
    points.push({ label: `Uke ${weeks - w}`, value: count });
  }
  return points;
}

export function yearPoints(leads: Lead[]) {
  const now = new Date();
  const points: { label: string; value: number }[] = [];
  for (let m = 11; m >= 0; m--) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const count = leads.filter((l) => {
      const created = new Date(l.created_at);
      return created.getFullYear() === d.getFullYear() && created.getMonth() === d.getMonth();
    }).length;
    points.push({ label: MONTHS[d.getMonth()], value: count });
  }
  return points;
}

export interface LeadStats {
  openCount: number;
  openTrend: number;
  newThisWeek: number;
  newTrend: number;
  dealValue: number;
  dealTrend: number;
  winRate: number;
  wonTrend: number;
  miniOpen: number[];
  miniNew: number[];
  miniDeal: number[];
  miniWon: number[];
}

/** All trends compare the last 7 days to the 7 days before that, computed from real `created_at` timestamps. */
export function computeLeadStats(myLeads: Lead[]): LeadStats {
  const weekAgo = daysAgo(6);
  const twoWeeksAgo = daysAgo(13);
  const oneWeekAgoEnd = daysAgo(7);

  const isOpen = (l: Lead) => OPEN_STATUSES.has(l.status);
  const openLeads = myLeads.filter(isOpen);
  const openThisWeek = openLeads.filter((l) => inRange(l, weekAgo)).length;
  const openLastWeek = openLeads.filter((l) => inRange(l, twoWeeksAgo, oneWeekAgoEnd)).length;

  const newThisWeek = myLeads.filter((l) => inRange(l, weekAgo)).length;
  const newLastWeek = myLeads.filter((l) => inRange(l, twoWeeksAgo, oneWeekAgoEnd)).length;

  const wonLeads = myLeads.filter((l) => l.status === "won");
  const lostLeads = myLeads.filter((l) => l.status === "lost");
  const dealValue = wonLeads.reduce((sum, l) => sum + (l.deal_size ?? 0), 0);
  const dealThisWeek = wonLeads
    .filter((l) => inRange(l, weekAgo))
    .reduce((sum, l) => sum + (l.deal_size ?? 0), 0);
  const dealLastWeek = wonLeads
    .filter((l) => inRange(l, twoWeeksAgo, oneWeekAgoEnd))
    .reduce((sum, l) => sum + (l.deal_size ?? 0), 0);

  const closedCount = wonLeads.length + lostLeads.length;
  const winRate = closedCount ? Math.round((wonLeads.length / closedCount) * 100) : 0;

  const wonThisWeek = wonLeads.filter((l) => inRange(l, weekAgo)).length;
  const wonLastWeek = wonLeads.filter((l) => inRange(l, twoWeeksAgo, oneWeekAgoEnd)).length;

  return {
    openCount: openLeads.length,
    openTrend: pctChange(openThisWeek, openLastWeek),
    newThisWeek,
    newTrend: pctChange(newThisWeek, newLastWeek),
    dealValue,
    dealTrend: pctChange(dealThisWeek, dealLastWeek),
    winRate,
    wonTrend: pctChange(wonThisWeek, wonLastWeek),
    miniOpen: bucketDaily(openLeads, 7).map((b) => b.value),
    miniNew: bucketDaily(myLeads, 7).map((b) => b.value),
    miniDeal: bucketDaily(wonLeads, 7, (l) => l.deal_size ?? 0).map((b) => b.value),
    miniWon: bucketDaily(wonLeads, 7).map((b) => b.value),
  };
}
