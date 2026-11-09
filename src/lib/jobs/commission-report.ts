import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";
import { formatCurrency } from "@/lib/utils";

interface ReportRow {
  id: string;
  title: string;
  starts_at: string;
  notes: string | null;
  commission_amount: number;
  seller: { full_name: string | null; email: string } | null;
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * Weekly commission report (Fridays). Marks every claimed meeting that has taken
 * place and wasn't reported yet as reported, then tells the admins (in-app +
 * email when Resend is configured) that they're waiting for a yes/no on
 * /admin/provisjon. Claims made after the cut-off simply go in next week's report.
 */
export async function runCommissionReport() {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("meetings")
    .select("id, title, starts_at, notes, commission_amount, seller:profiles!meetings_seller_id_fkey(full_name, email)")
    .eq("commission_claimed", true)
    .eq("commission_status", "pending")
    .is("commission_reported_at", null)
    .lte("starts_at", now)
    .order("starts_at", { ascending: true });
  if (error) {
    console.error("[commission-report]", error);
    return { ok: false, reported: 0, error: "query_failed" };
  }
  const rows = (data as unknown as ReportRow[] | null) ?? [];

  // Everything still waiting, including earlier weeks not answered yet.
  const { count: waiting } = await admin
    .from("meetings")
    .select("id", { count: "exact", head: true })
    .eq("commission_claimed", true)
    .eq("commission_status", "pending")
    .lte("starts_at", now);

  if (rows.length === 0) return { ok: true, reported: 0, waiting: waiting ?? 0 };

  const { error: updErr } = await admin
    .from("meetings")
    .update({ commission_reported_at: now })
    .in("id", rows.map((r) => r.id));
  if (updErr) {
    console.error("[commission-report] mark reported", updErr);
    return { ok: false, reported: 0, error: "update_failed" };
  }

  const sellers = new Set(rows.map((r) => r.seller?.email ?? "?"));
  const total = rows.reduce((s, r) => s + (r.commission_amount ?? 0), 0);
  const message =
    `Ukesrapport provisjon: ${rows.length} ${rows.length === 1 ? "nytt møte" : "nye møter"} fra ` +
    `${sellers.size} ${sellers.size === 1 ? "selger" : "selgere"} (${formatCurrency(total)}) venter på Ja/Nei.` +
    ((waiting ?? 0) > rows.length ? ` Totalt ${waiting} ubehandlet.` : "");

  const { data: admins } = await admin
    .from("profiles")
    .select("id, email")
    .eq("role", "admin")
    .eq("is_active", true);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const tableRows = rows
    .map(
      (r) => `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd">${esc(r.seller?.full_name ?? r.seller?.email ?? "?")}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd">${esc(new Date(r.starts_at).toLocaleDateString("nb-NO", { timeZone: "Europe/Oslo", weekday: "short", day: "numeric", month: "short" }))}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #ddd"><b>${esc(r.title)}</b><br><span style="color:#555">${esc(r.notes ?? "")}</span></td>
      </tr>`
    )
    .join("");
  const html = `<p>${esc(message)}</p>
    <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">${tableRows}</table>
    ${appUrl ? `<p><a href="${appUrl}/admin/provisjon">Gå til Provisjon og kryss Ja/Nei →</a></p>` : ""}`;

  for (const a of (admins as { id: string; email: string }[] | null) ?? []) {
    await notify(a.id, message, { type: "system" });
    await sendEmail({ to: a.email, subject: `Provisjon: ${rows.length} møter venter på godkjenning`, html });
  }

  return { ok: true, reported: rows.length, waiting: waiting ?? 0 };
}
