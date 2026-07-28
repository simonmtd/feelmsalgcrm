import { notFound } from "next/navigation";
import Link from "next/link";
import { requireProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { LeadDetail } from "@/components/lead-detail";
import type { Lead, LeadActivity } from "@/lib/types";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("*, niche:niches(*)")
    .eq("id", id)
    .single();

  if (!lead) notFound();
  if (profile.role !== "admin" && lead.assigned_to !== profile.id) notFound();

  const { data: activities } = await supabase
    .from("lead_activities")
    .select("*, seller:profiles(id, full_name, email)")
    .eq("lead_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <Link href="/leads" className="inline-block font-pixel text-[10px] uppercase tracking-wide text-wood-700 hover:text-ink">
        ← Tilbake til mine leads
      </Link>
      <LeadDetail lead={lead as Lead} activities={(activities as LeadActivity[]) ?? []} />
    </div>
  );
}
