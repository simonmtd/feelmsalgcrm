import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { Lead, Profile, LeadStatus } from "@/lib/types";

const OPEN_STATUSES = new Set<LeadStatus>(["new", "assigned", "contacted", "follow_up"]);

interface SellerStat {
  id: string;
  name: string;
  assigned: number;
  open: number;
  won: number;
  lost: number;
  winRate: number;
  wonValue: number;
}

export default async function AdminStatsPage() {
  const supabase = await createClient();

  const [{ data: sellersData }, { data: leadsData }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
    supabase.from("leads").select("assigned_to, status, deal_size"),
  ]);

  const leads = (leadsData as Pick<Lead, "assigned_to" | "status" | "deal_size">[] | null) ?? [];
  const sellers = (sellersData as Pick<Profile, "id" | "full_name" | "email">[] | null) ?? [];

  const stats: SellerStat[] = sellers.map((s) => {
    const mine = leads.filter((l) => l.assigned_to === s.id);
    const won = mine.filter((l) => l.status === "won");
    const lost = mine.filter((l) => l.status === "lost");
    const closed = won.length + lost.length;
    return {
      id: s.id,
      name: s.full_name ?? s.email,
      assigned: mine.length,
      open: mine.filter((l) => OPEN_STATUSES.has(l.status)).length,
      won: won.length,
      lost: lost.length,
      winRate: closed ? Math.round((won.length / closed) * 100) : 0,
      wonValue: won.reduce((sum, l) => sum + (l.deal_size ?? 0), 0),
    };
  });

  // Sort by won value, sellers with activity first.
  stats.sort((a, b) => b.wonValue - a.wonValue || b.assigned - a.assigned);

  const totals = stats.reduce(
    (acc, s) => ({
      assigned: acc.assigned + s.assigned,
      open: acc.open + s.open,
      won: acc.won + s.won,
      wonValue: acc.wonValue + s.wonValue,
    }),
    { assigned: 0, open: 0, won: 0, wonValue: 0 }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Selgerstatistikk</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/25 text-left text-xs uppercase text-wood-700">
              <th className="py-2 pr-4">Selger</th>
              <th className="py-2 pr-4 text-right">Tildelt</th>
              <th className="py-2 pr-4 text-right">Åpne</th>
              <th className="py-2 pr-4 text-right">Vunnet</th>
              <th className="py-2 pr-4 text-right">Tapt</th>
              <th className="py-2 pr-4 text-right">Vinnrate</th>
              <th className="py-2 pr-4 text-right">Vunnet verdi</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.id} className="border-b border-ink/15">
                <td className="py-2 pr-4 font-medium text-ink">{s.name}</td>
                <td className="py-2 pr-4 text-right font-mono">{s.assigned}</td>
                <td className="py-2 pr-4 text-right font-mono">{s.open}</td>
                <td className="py-2 pr-4 text-right font-mono text-forest-700">{s.won}</td>
                <td className="py-2 pr-4 text-right font-mono text-red-600">{s.lost}</td>
                <td className="py-2 pr-4 text-right font-mono">{s.winRate}%</td>
                <td className="py-2 pr-4 text-right font-mono font-bold">
                  {formatCurrency(s.wonValue)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-ink text-sm font-semibold">
              <td className="py-2 pr-4 uppercase text-wood-700">Totalt</td>
              <td className="py-2 pr-4 text-right font-mono">{totals.assigned}</td>
              <td className="py-2 pr-4 text-right font-mono">{totals.open}</td>
              <td className="py-2 pr-4 text-right font-mono text-forest-700">{totals.won}</td>
              <td className="py-2 pr-4" />
              <td className="py-2 pr-4" />
              <td className="py-2 pr-4 text-right font-mono font-bold">
                {formatCurrency(totals.wonValue)}
              </td>
            </tr>
          </tfoot>
        </table>
        {!sellers.length && (
          <p className="py-6 text-center text-sm text-wood-700">Ingen selgere ennå.</p>
        )}
      </CardContent>
    </Card>
  );
}
