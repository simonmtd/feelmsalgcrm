"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/dal";
import { throwSafe } from "@/lib/actions/errors";

/** Marks all of the current user's unread notifications as read. */
export async function markAllNotificationsRead() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", profile.id)
    .is("read_at", null);

  if (error) throwSafe("markAllNotificationsRead", error);

  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}
