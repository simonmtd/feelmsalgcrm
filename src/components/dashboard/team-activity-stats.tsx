"use client";

import { useMemo, useState } from "react";
import { Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { segmented } from "@/components/ui/segmented";

interface CallRow {
  seller_id: string;
  created_at: string;
}
interface MeetingRow {
  seller_id: string;
  type: string;
  signed: boolean;
  signed_at: string | null;
  created_at: string;
}
interface SellerRow {
  id: string;
  name: string;
}

const PERIODS = [
  { key: "day", label: "I dag" },
  { key: "week", label: "Uke" },
  { key: "month", label: "Måned" },
  { key: "year", label: "År" },
] as const;

type PeriodKey = (typeof PERIODS)[number]["key"];

/** Start of the chosen calendar period (local time). "I dag" = since midnight
 *  today, so yesterday's calls drop out of today but stay in week/month/year. */
function periodStart(nowMs: number, key: PeriodKey): number {
  const d = new Date(nowMs);
  d.setHours(0, 0, 0, 0);
  if (key === "week") {
    const mondayOffset = (d.getDay() + 6) % 7; // Mon = 0 … Sun = 6
    d.setDate(d.getDate() - mondayOffset);
  } else if (key === "month") {
    d.setDate(1);
  } else if (key === "year") {
    d.setMonth(0, 1);
  }
  return d.getTime();
}

/**
 * Team activity & hit-rate: how many calls each person made in the chosen
 * period, their daily average, and how those calls convert to meetings and
 * signed deals. Calls are team-visible, so both admins and sellers see everyone.
 */
export function TeamActivityStats({
  sellers,
  callLogs,
  meetings,
}: {
  sellers: SellerRow[];
  callLogs: CallRow[];
  meetings: MeetingRow[];
}) {
  const [periodKey, setPeriodKey] = useState<PeriodKey>("day");
  const [now] = useState(() => Date.now());
  const start = periodStart(now, periodKey);
  // Days elapsed in the current period so far (for the daily average).
  const daysElapsed = Math.max(1, Math.ceil((now - start) / 86_400_000));

  const rows = useMemo(() => {
    const inWindow = (iso: string | null) => iso != null && new Date(iso).getTime() >= start;
    return sellers
      .map((s) => {
        const calls = callLogs.filter((c) => c.seller_id === s.id && inWindow(c.created_at)).length;
        const mine = meetings.filter((m) => m.seller_id === s.id);
        const booked = mine.filter((m) => m.type !== "internal" && inWindow(m.created_at)).length;
        const signed = mine.filter((m) => m.signed && inWindow(m.signed_at ?? m.created_at)).length;
        return {
          id: s.id,
          name: s.name,
          calls,
          perDay: calls / daysElapsed,
          booked,
          signed,
          meetRate: calls ? Math.round((booked / calls) * 100) : 0,
          closeRate: calls ? Math.round((signed / calls) * 100) : 0,
        };
      })
      .filter((r) => r.calls > 0 || r.booked > 0 || r.signed > 0)
      .sort((a, b) => b.calls - a.calls || b.signed - a.signed);
  }, [sellers, callLogs, meetings, start, daysElapsed]);

  const totalCalls = rows.reduce((s, r) => s + r.calls, 0);
  const totalBooked = rows.reduce((s, r) => s + r.booked, 0);
  const totalSigned = rows.reduce((s, r) => s + r.signed, 0);

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-4 w-4" /> Aktivitet &amp; hit-rate
          </CardTitle>
          <div className={segmented.root}>
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriodKey(p.key)}
                className={segmented.item(periodKey === p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {rows.length ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] font-medium uppercase tracking-wider text-subtle">
                <th className="py-2 pr-4">Selger</th>
                <th className="py-2 pr-4 text-right">Samtaler</th>
                <th className="py-2 pr-4 text-right">Snitt/dag</th>
                <th className="py-2 pr-4 text-right">Møter</th>
                <th className="py-2 pr-4 text-right">Signert</th>
                <th className="py-2 pr-4 text-right">Møte-%</th>
                <th className="py-2 text-right">Close-%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line">
                  <td className="py-2 pr-4 font-medium text-fg">{r.name}</td>
                  <td className="py-2 pr-4 text-right">{r.calls}</td>
                  <td className="py-2 pr-4 text-right text-muted">
                    {r.perDay.toFixed(1)}
                  </td>
                  <td className="py-2 pr-4 text-right">{r.booked}</td>
                  <td className="py-2 pr-4 text-right">{r.signed}</td>
                  <td className="py-2 pr-4 text-right text-success">{r.meetRate}%</td>
                  <td className="py-2 text-right text-success">{r.closeRate}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="py-2 pr-4">Totalt</td>
                <td className="py-2 pr-4 text-right">{totalCalls}</td>
                <td className="py-2 pr-4 text-right text-muted">
                  {(totalCalls / daysElapsed).toFixed(1)}
                </td>
                <td className="py-2 pr-4 text-right">{totalBooked}</td>
                <td className="py-2 pr-4 text-right">{totalSigned}</td>
                <td className="py-2 pr-4 text-right text-success">
                  {totalCalls ? Math.round((totalBooked / totalCalls) * 100) : 0}%
                </td>
                <td className="py-2 text-right text-success">
                  {totalCalls ? Math.round((totalSigned / totalCalls) * 100) : 0}%
                </td>
              </tr>
            </tfoot>
          </table>
        ) : (
          <p className="py-6 text-center text-sm text-muted">
            Ingen samtaler registrert i perioden ennå.
          </p>
        )}
        <p className="mt-3 text-xs text-muted">
          Møte-% = booket møter delt på samtaler · Close-% = signerte deals delt på samtaler ·
          Snitt/dag = samtaler delt på antall dager i perioden.
        </p>
      </CardContent>
    </Card>
  );
}
