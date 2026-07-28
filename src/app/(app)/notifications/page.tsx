import { requireProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { NotificationsList } from "@/components/notifications/notifications-list";
import type { Notification } from "@/lib/types";

export default async function NotificationsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return <NotificationsList notifications={(data as Notification[] | null) ?? []} />;
}
