import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/dal";
import { loadCommissionMeetings } from "@/lib/commission-data";
import { commissionMonth } from "@/lib/commission";

/** CSV cell for Norwegian Excel (semicolon-separated, quotes doubled). */
function cell(v: string | number | null | undefined) {
  let s = v == null ? "" : String(v);
  // Neutralise spreadsheet formulas (CSV injection): a title like "=HYPERLINK(…)"
  // typed by a user must not execute when the file is opened in Excel.
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * GET /admin/provisjon/export?month=2026-11 → approved commission for that
 * month as CSV (one row per meeting + a total per seller), for payroll.
 */
export async function GET(request: Request) {
  await requireAdmin();
  const month = new URL(request.url).searchParams.get("month") ?? "";
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Bruk ?month=ÅÅÅÅ-MM" }, { status: 400 });
  }

  const meetings = (await loadCommissionMeetings())
    .filter((m) => m.commission_status === "approved" && commissionMonth(m.starts_at) === month)
    .sort((a, b) => (a.seller?.full_name ?? "").localeCompare(b.seller?.full_name ?? "") || a.starts_at.localeCompare(b.starts_at));

  const rows: (string | number | null)[][] = [["Selger", "E-post", "Dato", "Møte", "Kunde", "Beløp (kr)"]];
  const totals = new Map<string, { name: string; email: string; count: number; sum: number }>();
  for (const m of meetings) {
    const name = m.seller?.full_name ?? m.seller?.email ?? "Ukjent";
    const email = m.seller?.email ?? "";
    rows.push([
      name,
      email,
      new Date(m.starts_at).toLocaleDateString("nb-NO", { timeZone: "Europe/Oslo" }),
      m.title,
      m.lead?.company_name ?? "",
      m.commission_amount,
    ]);
    const t = totals.get(m.seller_id) ?? { name, email, count: 0, sum: 0 };
    t.count += 1;
    t.sum += m.commission_amount;
    totals.set(m.seller_id, t);
  }
  rows.push([], ["Sum per selger", "E-post", "Antall møter", "", "", "Beløp (kr)"]);
  for (const t of totals.values()) rows.push([t.name, t.email, t.count, "", "", t.sum]);
  rows.push(["Totalt", "", meetings.length, "", "", meetings.reduce((s, m) => s + m.commission_amount, 0)]);

  // BOM so Excel reads æøå correctly.
  const csv = "\uFEFF" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="provisjon-${month}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
