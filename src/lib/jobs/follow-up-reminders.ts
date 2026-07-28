import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";
import { formatDate } from "@/lib/utils";
import type { Lead, Profile } from "@/lib/types";

export interface ReminderResult {
  ok: boolean;
  leadsReminded: number;
  sellersNotified: number;
  emailsSent: number;
}

const OPEN_STATUSES = ["new", "assigned", "contacted", "follow_up"];

/**
 * Finds open leads whose follow-up date is due (today or overdue) and that
 * haven't already been reminded for that date, then notifies the assigned
 * seller in-app and by email. Marks follow_up_reminded_at so each follow-up
 * date only reminds once.
 */
export async function runFollowUpReminders(): Promise<ReminderResult> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: leadsData } = await supabase
    .from("leads")
    .select("*, niche:niches(*)")
    .not("assigned_to", "is", null)
    .not("next_follow_up_at", "is", null)
    .lte("next_follow_up_at", nowIso)
    .in("status", OPEN_STATUSES);

  const due = ((leadsData as Lead[] | null) ?? []).filter(
    (l) => !l.follow_up_reminded_at || l.follow_up_reminded_at < (l.next_follow_up_at ?? "")
  );

  if (due.length === 0) {
    return { ok: true, leadsReminded: 0, sellersNotified: 0, emailsSent: 0 };
  }

  // Group due leads by seller.
  const bySeller = new Map<string, Lead[]>();
  for (const lead of due) {
    const list = bySeller.get(lead.assigned_to!) ?? [];
    list.push(lead);
    bySeller.set(lead.assigned_to!, list);
  }

  const sellerIds = [...bySeller.keys()];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in("id", sellerIds);
  const profileById = new Map(
    ((profiles as Pick<Profile, "id" | "email" | "full_name">[] | null) ?? []).map((p) => [p.id, p])
  );

  let emailsSent = 0;

  for (const [sellerId, leads] of bySeller) {
    const profile = profileById.get(sellerId);

    // In-app: one notification per due lead, linking straight to it.
    for (const lead of leads) {
      await notify(sellerId, `Følg opp: ${lead.company_name ?? "kunde"} — oppfølging forfaller i dag.`, {
        type: "system",
        leadId: lead.id,
      });
    }

    // Email: one summary listing all due leads.
    if (profile?.email) {
      const rows = leads
        .map(
          (l) =>
            `<li><strong>${escapeHtml(l.company_name ?? "Ukjent firma")}</strong>` +
            `${l.contact_name ? ` — ${escapeHtml(l.contact_name)}` : ""}` +
            `${l.phone ? ` — ${escapeHtml(l.phone)}` : ""}` +
            ` <span style="color:#777">(satt til ${formatDate(l.next_follow_up_at)})</span></li>`
        )
        .join("");
      const html =
        `<p>Hei ${escapeHtml(profile.full_name ?? "")},</p>` +
        `<p>Du har <strong>${leads.length}</strong> ${leads.length === 1 ? "kunde" : "kunder"} å følge opp i dag:</p>` +
        `<ul>${rows}</ul>` +
        `<p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://feelmsalgcrm.vercel.app"}/today">Åpne Feelm Leads</a></p>`;

      const result = await sendEmail({
        to: profile.email,
        subject: `${leads.length} ${leads.length === 1 ? "kunde" : "kunder"} å følge opp i dag`,
        html,
      });
      if (result.ok) emailsSent += 1;
    }

    // Mark these leads as reminded for their current follow-up date.
    await supabase
      .from("leads")
      .update({ follow_up_reminded_at: nowIso })
      .in(
        "id",
        leads.map((l) => l.id)
      );
  }

  return {
    ok: true,
    leadsReminded: due.length,
    sellersNotified: bySeller.size,
    emailsSent,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
