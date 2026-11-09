import { requireAdmin } from "@/lib/dal";
import { loadCommissionMeetings, groupBy, type CommissionMeeting } from "@/lib/commission-data";
import { commissionMonth, commissionWeek, monthLabel } from "@/lib/commission";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReviewButtons } from "@/components/commission/review-buttons";
import { formatCurrency } from "@/lib/utils";

function sellerName(m: CommissionMeeting) {
  return m.seller?.full_name ?? m.seller?.email ?? "Ukjent";
}

function ReviewTable({ meetings }: { meetings: CommissionMeeting[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-ink/25 text-left text-xs uppercase text-wood-700">
          <th className="py-2 pr-4">Selger</th>
          <th className="py-2 pr-4">Dato</th>
          <th className="py-2 pr-4">Møte og notat</th>
          <th className="py-2 pr-4">Beløp</th>
          <th className="py-2">Kvalifisert?</th>
        </tr>
      </thead>
      <tbody>
        {meetings.map((m) => (
          <tr key={m.id} className="border-b border-ink/15 align-top">
            <td className="py-3 pr-4 font-medium text-ink">{sellerName(m)}</td>
            <td className="py-3 pr-4 font-mono text-xs text-wood-700">
              {new Date(m.starts_at).toLocaleDateString("nb-NO", {
                timeZone: "Europe/Oslo",
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
              {!m.commission_reported_at && m.commission_status === "pending" && (
                <span className="mt-1 block font-sans text-[11px] text-wood-600">ikke i rapport ennå</span>
              )}
            </td>
            <td className="py-3 pr-4">
              <p className="font-medium text-ink">{m.title}</p>
              {m.lead?.company_name && <p className="text-xs text-wood-700">{m.lead.company_name}</p>}
              <p className="mt-1 max-w-lg whitespace-pre-line text-xs italic text-wood-800">
                {m.notes || "(uten notat)"}
              </p>
            </td>
            <td className="py-3 pr-4 font-mono text-sm font-bold text-ink">{formatCurrency(m.commission_amount)}</td>
            <td className="py-3">
              <ReviewButtons meetingId={m.id} status={m.commission_status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function AdminCommissionPage() {
  await requireAdmin();
  const meetings = await loadCommissionMeetings();
  const nowIso = new Date().toISOString();

  const happened = meetings.filter((m) => m.starts_at <= nowIso);
  const upcoming = meetings.filter((m) => m.starts_at > nowIso);
  const pending = happened.filter((m) => m.commission_status === "pending");
  const reviewed = happened.filter((m) => m.commission_status !== "pending");

  // Payout per month per seller (approved only), latest 3 months with activity.
  const approved = happened.filter((m) => m.commission_status === "approved");
  const months = groupBy(approved, (m) => commissionMonth(m.starts_at)).slice(0, 3);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Venter på svar ({pending.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 overflow-x-auto">
          {pending.length === 0 ? (
            <p className="py-4 text-center text-sm text-wood-700">Ingen provisjonskrav venter. 🎉</p>
          ) : (
            groupBy(pending, (m) => commissionWeek(m.starts_at).key).map(([key, ms]) => (
              <div key={key} className="flex flex-col gap-2">
                <p className="font-pixel text-[10px] uppercase text-wood-800">
                  {commissionWeek(ms[0].starts_at).label} · {ms.length} møter ·{" "}
                  {formatCurrency(ms.reduce((s, m) => s + m.commission_amount, 0))}
                </p>
                <ReviewTable meetings={ms} />
              </div>
            ))
          )}
          {upcoming.length > 0 && (
            <p className="text-xs text-wood-700">
              + {upcoming.length} kommende provisjonsmøter som kommer med i rapporten etter at de er gjennomført.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Oppgjør per måned</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 overflow-x-auto">
          {months.length === 0 ? (
            <p className="text-sm text-wood-700">Ingen godkjente møter ennå.</p>
          ) : (
            months.map(([month, ms]) => (
              <div key={month}>
                <p className="mb-2 font-medium capitalize text-ink">
                  {monthLabel(month)} · {formatCurrency(ms.reduce((s, m) => s + m.commission_amount, 0))}
                </p>
                <div className="flex flex-wrap gap-2">
                  {groupBy(ms, sellerName).map(([name, sm]) => (
                    <Badge key={name} variant="green">
                      {name}: {sm.length} møter · {formatCurrency(sm.reduce((s, m) => s + m.commission_amount, 0))}
                    </Badge>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {reviewed.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Behandlet (siste {Math.min(reviewed.length, 30)})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <ReviewTable meetings={reviewed.slice(0, 30)} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
