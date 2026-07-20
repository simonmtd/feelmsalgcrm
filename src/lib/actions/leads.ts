"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/dal";
import type { ActivityType, FilmingStatus, LeadStatus } from "@/lib/types";

export async function switchActiveNiche(nicheId: string) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ active_niche_id: nicheId })
    .eq("id", profile.id);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
}

async function assertOwnsLead(leadId: string) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: lead, error } = await supabase
    .from("leads")
    .select("id, assigned_to")
    .eq("id", leadId)
    .single();

  if (error || !lead) throw new Error("Fant ikke lead.");
  if (profile.role !== "admin" && lead.assigned_to !== profile.id) {
    throw new Error("Du har ikke tilgang til denne leaden.");
  }

  return { profile, supabase };
}

export async function updateLeadStatus(leadId: string, status: LeadStatus) {
  const { profile, supabase } = await assertOwnsLead(leadId);

  const { error } = await supabase.from("leads").update({ status }).eq("id", leadId);
  if (error) throw new Error(error.message);

  await supabase.from("lead_activities").insert({
    lead_id: leadId,
    seller_id: profile.id,
    type: "status_change" as ActivityType,
    content: `Status endret til "${status}".`,
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/dashboard");
}

export async function updateLeadFilmingStatus(
  leadId: string,
  filming_status: FilmingStatus
) {
  const { profile, supabase } = await assertOwnsLead(leadId);

  const { error } = await supabase
    .from("leads")
    .update({ filming_status })
    .eq("id", leadId);
  if (error) throw new Error(error.message);

  await supabase.from("lead_activities").insert({
    lead_id: leadId,
    seller_id: profile.id,
    type: "filming_update" as ActivityType,
    content: `Filming-status endret til "${filming_status}".`,
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
}

export async function updateLeadDetails(
  leadId: string,
  fields: { deal_size?: number | null; next_follow_up_at?: string | null }
) {
  const { supabase } = await assertOwnsLead(leadId);

  const { error } = await supabase.from("leads").update(fields).eq("id", leadId);
  if (error) throw new Error(error.message);

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
}

export async function addLeadActivity(
  leadId: string,
  type: ActivityType,
  content: string
) {
  if (!content.trim()) return;
  const { profile, supabase } = await assertOwnsLead(leadId);

  const { error } = await supabase.from("lead_activities").insert({
    lead_id: leadId,
    seller_id: profile.id,
    type,
    content: content.trim(),
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/leads/${leadId}`);
}
