"use client";

import { useMemo, useState } from "react";
import { Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
  { key: "day", label: "I dag", days: 1 },
  { key: "week", label: "Uke", days: 7 },
  { key: "month", label: "Måned", days: 30 },
  { key: "year", label: "År", days: 365 },
] as const;

type PeriodKey = (typeof PERIODS)[number]["key"];

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
  const [periodKey, setPeriodKey] = useState<PeriodKey>("week");
  const [now] = useState(() => Date.now());
  const period = PERIODS.find((p) => p.key === periodKey) ?? PERIODS[1];
  const start = now - period.days * 86_400_000;

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
          perDay: calls / period.days,
          booked,
          signed,
          meetRate: calls ? Math.round((booked / calls) * 100) : 0,
          closeRate: calls ? Math.round((signed / calls) * 100) : 0,
        };
      })
      .filter((r) => r.calls > 0 || r.booked > 0 || r.signed > 0)
      .sort((a, b) => b.calls - a.calls || b.signed - a.signed);
  }, [sellers, callLogs, meetings, start, period.days]);

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
          <div className="flex gap-1.5">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriodKey(p.key)}
                className={cn(
                  "rounded-sm border-2 border-ink px-2.5 py-1 font-pixel text-[8px] uppercase tracking-wide shadow-[2px_2px_0_0_var(--color-ink)] transition-colors",
                  periodKey === p.key
                    ? "bg-gold-500 text-ink"
                    : "bg-parchment text-wood-800 hover:bg-gold-100"
                )}
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
              <tr className="border-b border-ink/25 text-left text-xs uppercase text-wood-700">
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
                <tr key={r.id} className="border-b border-ink/10">
                  <td className="py-2 pr-4 font-medium text-ink">{r.name}</td>
                  <td className="py-2 pr-4 text-right font-mono">{r.calls}</td>
                  <td className="py-2 pr-4 text-right font-mono text-wood-700">
                    {r.perDay.toFixed(1)}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono">{r.booked}</td>
                  <td className="py-2 pr-4 text-right font-mono">{r.signed}</td>
                  <td className="py-2 pr-4 text-right font-mono text-forest-700">{r.meetRate}%</td>
                  <td className="py-2 text-right font-mono text-forest-700">{r.closeRate}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="py-2 pr-4">Totalt</td>
                <td className="py-2 pr-4 text-right font-mono">{totalCalls}</td>
                <td className="py-2 pr-4 text-right font-mono text-wood-700">
                  {(totalCalls / period.days).toFixed(1)}
                </td>
                <td className="py-2 pr-4 text-right font-mono">{totalBooked}</td>
                <td className="py-2 pr-4 text-right font-mono">{totalSigned}</td>
                <td className="py-2 pr-4 text-right font-mono text-forest-700">
                  {totalCalls ? Math.round((totalBooked / totalCalls) * 100) : 0}%
                </td>
                <td className="py-2 text-right font-mono text-forest-700">
                  {totalCalls ? Math.round((totalSigned / totalCalls) * 100) : 0}%
                </td>
              </tr>
            </tfoot>
          </table>
        ) : (
          <p className="py-6 text-center text-sm text-wood-700">
            Ingen samtaler registrert i perioden ennå.
          </p>
        )}
        <p className="mt-3 text-xs text-wood-700">
          Møte-% = booket møter delt på samtaler · Close-% = signerte deals delt på samtaler ·
          Snitt/dag = samtaler delt på antall dager i perioden.
        </p>
      </CardContent>
    </Card>
  );
}
