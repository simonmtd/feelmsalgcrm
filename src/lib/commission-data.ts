import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Meeting } from "@/lib/types";

export type CommissionMeeting = Meeting;

/** Claimed meetings (with seller + customer), newest first. `sellerId` limits to one seller. */
export async function loadCommissionMeetings(sellerId?: string): Promise<CommissionMeeting[]> {
  const supabase = await createClient();
  let q = supabase
    .from("meetings")
    .select(
      "*, seller:profiles!meetings_seller_id_fkey(id, full_name, email), lead:leads(id, company_name, contact_name)"
    )
    .eq("commission_claimed", true)
    .order("starts_at", { ascending: false });
  if (sellerId) q = q.eq("seller_id", sellerId);
  const { data } = await q;
  return (data as CommissionMeeting[] | null) ?? [];
}

/** Groups items by a key, keeping first-seen order. */
export function groupBy<T>(items: T[], key: (t: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    map.set(k, [...(map.get(k) ?? []), it]);
  }
  return [...map.entries()];
}
