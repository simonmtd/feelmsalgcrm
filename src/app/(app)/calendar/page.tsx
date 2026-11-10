import { requireProfile } from "@/lib/dal";
import { fetchAll } from "@/lib/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TeamCalendar } from "@/components/calendar/team-calendar";
import type { Lead, Meeting, Profile } from "@/lib/types";
import { MEETING_TYPE_LABELS } from "@/lib/types";

export default async function CalendarPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const isAdmin = profile.role === "admin";

  // The team calendar shows everyone's meetings, so it reads with the service
  // role (RLS only exposes a seller's own). For other sellers' meetings a
  // seller sees time, type and who – customer, title, notes and value are stripped.
  const admin = createAdminClient();
  const { data: team } = await admin
    .from("profiles")
    .select("*, active_niche:niches(*)")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  const meetingsAll = await fetchAll<Meeting>((from, to) =>
    admin
      .from("meetings")
      .select("*, seller:profiles!meetings_seller_id_fkey(id, full_name, email), lead:leads(id, company_name, contact_name)")
      .order("starts_at", { ascending: true })
      .order("id")
      .range(from, to)
  );
  const meetingsRaw = meetingsAll.map((m) =>
    isAdmin || m.seller_id === profile.id
      ? m
      : {
          ...m,
          // Titles usually name the customer ("Demo for Kystmegleren AS").
          title: MEETING_TYPE_LABELS[m.type] ?? "Møte",
          lead: null,
          lead_id: null,
          notes: null,
          deal_size: null,
          location: null,
        }
  );

  // The "new meeting" form lets you attach a customer — sellers pick from their
  // own leads, an admin from everyone's.
  const leadOptions = fetchAll<Pick<Lead, "id" | "company_name" | "contact_name">>((from, to) => {
    let q = supabase
      .from("leads")
      .select("id, company_name, contact_name")
      .order("company_name", { ascending: true })
      .order("id");
    if (!isAdmin) q = q.eq("assigned_to", profile.id);
    return q.range(from, to);
  });
  const leads = await leadOptions;

  return (
    <TeamCalendar
      currentProfile={profile}
      team={(team as Profile[] | null) ?? []}
      meetings={(meetingsRaw as Meeting[] | null) ?? []}
      leads={(leads as Pick<Lead, "id" | "company_name" | "contact_name">[] | null) ?? []}
    />
  );
}
