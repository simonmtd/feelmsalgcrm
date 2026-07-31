"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/dal";
import { safeError, throwSafe } from "@/lib/actions/errors";
import { MEETING_TYPE_LABELS, PRODUCT_TYPE_LABELS } from "@/lib/types";
import type { MeetingType, ProductType } from "@/lib/types";

const MEETING_TYPES = new Set(Object.keys(MEETING_TYPE_LABELS));
const PRODUCT_TYPES = new Set(Object.keys(PRODUCT_TYPE_LABELS));

export interface MeetingActionState {
  error?: string;
  success?: string;
}

function revalidateMeetingViews() {
  revalidatePath("/calendar");
  revalidatePath("/meetings");
  revalidatePath("/dashboard");
}

/**
 * Marks a meeting's deal as signed (or not). A seller can do this for their own
 * meetings, an admin for anyone's. Feeds the dashboard leaderboard.
 */
export async function setMeetingSigned(
  meetingId: string,
  signed: boolean,
  amount?: number | null
) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: meeting } = await supabase
    .from("meetings")
    .select("id, seller_id")
    .eq("id", meetingId)
    .single();

  if (!meeting) throw new Error("Fant ikke møtet.");
  if (profile.role !== "admin" && meeting.seller_id !== profile.id) {
    throw new Error("Du kan bare endre dine egne møter.");
  }

  const update: {
    signed: boolean;
    signed_at: string | null;
    deal_size?: number;
  } = {
    signed,
    signed_at: signed ? new Date().toISOString() : null,
  };
  // When signing, let the seller enter/confirm the signed amount.
  if (signed && amount != null) {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error("Beløpet må være et positivt tall.");
    }
    update.deal_size = amount;
  }

  const { error } = await supabase.from("meetings").update(update).eq("id", meetingId);
  if (error) throwSafe("setMeetingSigned", error);

  revalidateMeetingViews();
}

export async function createMeeting(
  _prevState: MeetingActionState | undefined,
  formData: FormData
): Promise<MeetingActionState> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const type = String(formData.get("type") ?? "sales_meeting") as MeetingType;
  const date = String(formData.get("date") ?? "");
  const startTime = String(formData.get("start_time") ?? "");
  const endTime = String(formData.get("end_time") ?? "");
  const location = String(formData.get("location") ?? "").trim().slice(0, 200) || null;
  const requestedSellerId = String(formData.get("seller_id") ?? "");
  const leadId = String(formData.get("lead_id") ?? "") || null;
  const productRaw = String(formData.get("product_type") ?? "");
  const dealSizeRaw = String(formData.get("deal_size") ?? "").trim();

  if (!title || !date || !startTime || !endTime) {
    return { error: "Fyll ut tittel, dato og tidspunkt." };
  }
  if (!MEETING_TYPES.has(type)) {
    return { error: "Ugyldig møtetype." };
  }
  if (productRaw && !PRODUCT_TYPES.has(productRaw)) {
    return { error: "Ugyldig produkttype." };
  }

  const startsAt = new Date(`${date}T${startTime}`);
  const endsAt = new Date(`${date}T${endTime}`);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    return { error: "Sluttidspunktet må være etter starttidspunktet." };
  }

  let dealSize: number | null = null;
  if (dealSizeRaw) {
    const parsed = Number(dealSizeRaw);
    if (Number.isNaN(parsed) || parsed < 0) {
      return { error: "Deal size må være et positivt tall." };
    }
    dealSize = parsed;
  }

  const sellerId = profile.role === "admin" && requestedSellerId ? requestedSellerId : profile.id;

  const { error } = await supabase.from("meetings").insert({
    seller_id: sellerId,
    lead_id: leadId,
    title,
    type,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    location,
    deal_size: dealSize,
    product_type: (productRaw || null) as ProductType | null,
  });

  if (error) return { error: safeError("createMeeting", error) };

  revalidateMeetingViews();
  return { success: "Møtet ble lagt til." };
}

export async function deleteMeeting(meetingId: string) {
  const profile = await requireProfile();
  const supabase = await createClient();

  // RLS also enforces this, but check here so non-owners get a clear error.
  const { data: meeting } = await supabase
    .from("meetings")
    .select("id, seller_id")
    .eq("id", meetingId)
    .single();

  if (!meeting) throw new Error("Fant ikke møtet.");
  if (profile.role !== "admin" && meeting.seller_id !== profile.id) {
    throw new Error("Du kan bare slette dine egne møter.");
  }

  const { error } = await supabase.from("meetings").delete().eq("id", meetingId);
  if (error) throwSafe("deleteMeeting", error);

  revalidateMeetingViews();
}
