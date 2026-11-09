"use server";

import { revalidatePath, refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, requireProfile } from "@/lib/dal";
import { safeError } from "@/lib/actions/errors";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { COMMISSION_NOTE_MIN } from "@/lib/commission";
import { formatCurrency } from "@/lib/utils";

export interface CommissionActionResult {
  ok: boolean;
  error?: string;
}

function revalidateCommissionViews() {
  revalidatePath("/meetings");
  revalidatePath("/provisjon");
  revalidatePath("/admin/provisjon");
  refresh();
}

/**
 * A seller claims commission on one of their meetings. A note on what happened
 * in the meeting is required; it is what the admin reviews at the end of the week.
 */
export async function claimCommission(meetingId: string, note: string): Promise<CommissionActionResult> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const text = (note ?? "").trim().slice(0, 5000);
  if (text.length < COMMISSION_NOTE_MIN) {
    return { ok: false, error: `Skriv et notat om møtet (minst ${COMMISSION_NOTE_MIN} tegn).` };
  }

  const { data: meeting } = await supabase
    .from("meetings")
    .select("id, seller_id, type, commission_claimed, commission_status")
    .eq("id", meetingId)
    .single();
  if (!meeting) return { ok: false, error: "Fant ikke møtet." };
  if (profile.role !== "admin" && meeting.seller_id !== profile.id) {
    return { ok: false, error: "Du kan bare kreve provisjon for dine egne møter." };
  }
  if (meeting.type === "internal") {
    return { ok: false, error: "Interne møter gir ikke provisjon." };
  }
  if (meeting.commission_claimed && meeting.commission_status !== "pending") {
    return { ok: false, error: "Møtet er allerede behandlet." };
  }

  const { error } = await supabase
    .from("meetings")
    .update({ commission_claimed: true, notes: text })
    .eq("id", meetingId);
  if (error) return { ok: false, error: safeError("claimCommission", error) };

  revalidateCommissionViews();
  return { ok: true };
}

/** Withdraws a commission claim that hasn't been reviewed yet. */
export async function withdrawCommission(meetingId: string): Promise<CommissionActionResult> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: meeting } = await supabase
    .from("meetings")
    .select("id, seller_id, commission_status")
    .eq("id", meetingId)
    .single();
  if (!meeting) return { ok: false, error: "Fant ikke møtet." };
  if (profile.role !== "admin" && meeting.seller_id !== profile.id) {
    return { ok: false, error: "Du kan bare endre dine egne møter." };
  }
  if (meeting.commission_status !== "pending") {
    return { ok: false, error: "Møtet er allerede behandlet." };
  }

  const { error } = await supabase.from("meetings").update({ commission_claimed: false }).eq("id", meetingId);
  if (error) return { ok: false, error: safeError("withdrawCommission", error) };

  revalidateCommissionViews();
  return { ok: true };
}

/** Admin: approve (qualified meeting → commission) or reject a claim. */
export async function reviewCommission(meetingId: string, approve: boolean): Promise<CommissionActionResult> {
  const actor = await requireAdmin();
  const admin = createAdminClient();

  const { data } = await admin
    .from("meetings")
    .select("id, seller_id, title, starts_at, commission_claimed, commission_amount, commission_status")
    .eq("id", meetingId)
    .single();
  const meeting = data as {
    id: string;
    seller_id: string;
    title: string;
    starts_at: string;
    commission_claimed: boolean;
    commission_amount: number;
    commission_status: string;
  } | null;
  if (!meeting || !meeting.commission_claimed) return { ok: false, error: "Fant ikke provisjonskravet." };
  if (new Date(meeting.starts_at).getTime() > Date.now()) {
    return { ok: false, error: "Møtet har ikke funnet sted ennå." };
  }

  const status = approve ? "approved" : "rejected";
  if (meeting.commission_status === status) return { ok: true };

  const { error } = await admin
    .from("meetings")
    .update({
      commission_status: status,
      commission_reviewed_at: new Date().toISOString(),
      commission_reviewed_by: actor.id,
    })
    .eq("id", meetingId);
  if (error) return { ok: false, error: safeError("reviewCommission", error) };

  await notify(
    meeting.seller_id,
    approve
      ? `Provisjon godkjent: «${meeting.title}» (${formatCurrency(meeting.commission_amount)}).`
      : `Provisjon avslått: «${meeting.title}».`,
    { type: "system" }
  );
  await logAudit(actor, approve ? "commission.approve" : "commission.reject", {
    targetType: "meeting",
    targetId: meetingId,
    details: { seller_id: meeting.seller_id, amount: meeting.commission_amount },
  });

  revalidateCommissionViews();
  return { ok: true };
}
