import { requireProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { TeamCalendar } from "@/components/calendar/team-calendar";
import type { Lead, Meeting, Profile } from "@/lib/types";

export default async function CalendarPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const isAdmin = profile.role === "admin";

  const { data: team } = await supabase
    .from("profiles")
    .select("*, active_niche:niches(*)")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  const { data: meetingsRaw } = await supabase
    .from("meetings")
    .select("*, seller:profiles(id, full_name, email), lead:leads(id, company_name, contact_name)")
    .order("starts_at", { ascending: true });

  // The "new meeting" form lets you attach a customer — sellers pick from their
  // own leads, an admin from everyone's.
  let leadsQuery = supabase
    .from("leads")
    .select("id, company_name, contact_name")
    .order("company_name", { ascending: true });
  if (!isAdmin) leadsQuery = leadsQuery.eq("assigned_to", profile.id);
  const { data: leads } = await leadsQuery;

  return (
    <TeamCalendar
      currentProfile={profile}
      team={(team as Profile[] | null) ?? []}
      meetings={(meetingsRaw as Meeting[] | null) ?? []}
      leads={(leads as Pick<Lead, "id" | "company_name" | "contact_name">[] | null) ?? []}
    />
  );
}
