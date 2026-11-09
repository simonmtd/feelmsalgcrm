import Link from "next/link";
import { requireProfile } from "@/lib/dal";
import { loadCommissionMeetings, groupBy } from "@/lib/commission-data";
import { commissionMonth, commissionWeek, monthLabel, COMMISSION_PER_MEETING } from "@/lib/commission";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { COMMISSION_STATUS_LABELS } from "@/lib/types";

const STATUS_VARIANT = { pending: "amber", approved: "green", rejected: "red" } as const;

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="font-pixel text-[10px] uppercase leading-relaxed text-wood-800">{label}</p>
        <p className="mt-2 font-mono text-2xl font-bold text-ink">{value}</p>
        {hint && <p className="mt-1 text-xs text-wood-700">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default async function MyCommissionPage() {
  const profile = await requireProfile();
  const meetings = await loadCommissionMeetings(profile.id);
  const nowIso = new Date().toISOString();
  const thisMonth = commissionMonth(nowIso);

  const approved = meetings.filter((m) => m.commission_status === "approved");
  const pending = meetings.filter((m) => m.commission_status === "pending");
  const sum = (ms: typeof meetings) => ms.reduce((s, m) => s + m.commission_amount, 0);
  const approvedThisMonth = approved.filter((m) => commissionMonth(m.starts_at) === thisMonth);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label={`Godkjent ${monthLabel(thisMonth)}`}
          value={formatCurrency(sum(approvedThisMonth))}
          hint={`${approvedThisMonth.length} kvalifiserte møter`}
        />
        <Stat
          label="Venter på svar"
          value={formatCurrency(sum(pending))}
          hint={`${pending.length} møter · behandles i ukesrapporten fredag`}
        />
        <Stat label="Godkjent totalt" value={formatCurrency(sum(approved))} hint={`${approved.length} møter`} />
      </div>

      <Card>
        <CardContent className="pt-5 text-sm text-wood-800">
          Du får {formatCurrency(COMMISSION_PER_MEETING)} per kvalifiserte møte. Registrer møtet på{" "}
          <Link href="/meetings" className="font-medium underline hover:text-ink">
            Møter
          </Link>{" "}
          og huk av «Provisjonsmøte», eller trykk «Krev» på et møte du alt har lagt inn. Notat er
          påkrevd. Hver fredag går gjennomførte møter til godkjenning.
        </CardContent>
      </Card>

      {meetings.length === 0 ? (
        <p className="py-6 text-center text-sm text-wood-700">Ingen provisjonsmøter ennå.</p>
      ) : (
        groupBy(meetings, (m) => commissionWeek(m.starts_at).key).map(([key, ms]) => (
          <Card key={key}>
            <CardHeader className="pb-3">
              <CardTitle>{commissionWeek(ms[0].starts_at).label}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {ms.map((m) => (
                    <tr key={m.id} className="border-b border-ink/15 align-top">
                      <td className="py-3 pr-4 font-mono text-xs text-wood-700">
                        {new Date(m.starts_at).toLocaleDateString("nb-NO", {
                          timeZone: "Europe/Oslo",
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-medium text-ink">{m.title}</p>
                        {m.lead?.company_name && <p className="text-xs text-wood-700">{m.lead.company_name}</p>}
                        {m.notes && (
                          <p className="mt-1 max-w-md whitespace-pre-line text-xs italic text-wood-700">{m.notes}</p>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <Badge variant={STATUS_VARIANT[m.commission_status]}>
                          {m.starts_at > nowIso && m.commission_status === "pending"
                            ? "Kommende"
                            : COMMISSION_STATUS_LABELS[m.commission_status]}{" "}
                          · {formatCurrency(m.commission_amount)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
