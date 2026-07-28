import { requireProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { MeetingsView } from "@/components/meetings/meetings-view";
import type { Lead, Meeting, Profile } from "@/lib/types";

export default async function MeetingsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const isAdmin = profile.role === "admin";

  // Sellers manage their own booked meetings; an admin oversees the whole team's.
  let meetingsQuery = supabase
    .from("meetings")
    .select("*, seller:profiles(id, full_name, email), lead:leads(id, company_name, contact_name)")
    .order("starts_at", { ascending: true });
  if (!isAdmin) meetingsQuery = meetingsQuery.eq("seller_id", profile.id);

  let leadsQuery = supabase
    .from("leads")
    .select("id, company_name, contact_name")
    .order("company_name", { ascending: true });
  if (!isAdmin) leadsQuery = leadsQuery.eq("assigned_to", profile.id);

  const [{ data: meetings }, { data: leads }, { data: team }] = await Promise.all([
    meetingsQuery,
    leadsQuery,
    supabase.from("profiles").select("id, full_name, email").eq("is_active", true),
  ]);

  return (
    <MeetingsView
      profile={profile}
      meetings={(meetings as Meeting[] | null) ?? []}
      leads={(leads as Pick<Lead, "id" | "company_name" | "contact_name">[] | null) ?? []}
      team={(team as Pick<Profile, "id" | "full_name" | "email">[] | null) ?? []}
    />
  );
}
