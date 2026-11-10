import { requireProfile } from "@/lib/dal";
import { fetchAll } from "@/lib/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { MeetingsView } from "@/components/meetings/meetings-view";
import type { Lead, Meeting, Profile } from "@/lib/types";

export default async function MeetingsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const isAdmin = profile.role === "admin";

  // Sellers manage their own booked meetings; an admin oversees the whole team's.
  const meetingsPage = (from: number, to: number) => {
    let q = supabase
      .from("meetings")
      .select("*, seller:profiles!meetings_seller_id_fkey(id, full_name, email), lead:leads(id, company_name, contact_name)")
      .order("starts_at", { ascending: true })
      .order("id");
    if (!isAdmin) q = q.eq("seller_id", profile.id);
    return q.range(from, to);
  };

  const leadOptions = fetchAll<Pick<Lead, "id" | "company_name" | "contact_name">>((from, to) => {
    let q = supabase
      .from("leads")
      .select("id, company_name, contact_name")
      .order("company_name", { ascending: true })
      .order("id");
    if (!isAdmin) q = q.eq("assigned_to", profile.id);
    return q.range(from, to);
  });

  const [meetings, leads, { data: team }] = await Promise.all([
    fetchAll<Meeting>(meetingsPage),
    leadOptions,
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
