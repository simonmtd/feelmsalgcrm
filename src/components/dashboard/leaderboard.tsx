import { Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export interface LeaderboardRow {
  id: string;
  name: string;
  meetings: number;
  signedCount: number;
  signedSum: number;
}

const MEDALS = ["🥇", "🥈", "🥉"];

/** Team scoreboard: meetings booked + signed count/value per seller, ranked. */
export function Leaderboard({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-4 w-4" /> Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            Ingen selgere å vise ennå.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] font-medium uppercase tracking-wider text-subtle">
                <th className="py-2 pr-4">#</th>
                <th className="py-2 pr-4">Selger</th>
                <th className="py-2 pr-4 text-right">Møter booket</th>
                <th className="py-2 pr-4 text-right">Signert</th>
                <th className="py-2 text-right">Sum signert</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.id}
                  className="border-b border-line last:border-0"
                >
                  <td className="py-2.5 pr-4 eyebrow">
                    {MEDALS[i] ?? i + 1}
                  </td>
                  <td className="py-2.5 pr-4 font-medium text-fg">{row.name}</td>
                  <td className="py-2.5 pr-4 text-right text-fg">
                    {row.meetings}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-fg">
                    {row.signedCount}
                  </td>
                  <td className="py-2.5 text-right font-bold text-success">
                    {formatCurrency(row.signedSum)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
