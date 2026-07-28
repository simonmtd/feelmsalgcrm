"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/dal";
import { throwSafe } from "@/lib/actions/errors";
import {
  LEAD_STATUS_LABELS,
  FILMING_STATUS_LABELS,
  ACTIVITY_TYPE_LABELS,
} from "@/lib/types";
import type { ActivityType, FilmingStatus, LeadStatus } from "@/lib/types";

const LEAD_STATUSES = new Set(Object.keys(LEAD_STATUS_LABELS));
const FILMING_STATUSES = new Set(Object.keys(FILMING_STATUS_LABELS));
const ACTIVITY_TYPES = new Set(Object.keys(ACTIVITY_TYPE_LABELS));

export async function switchActiveNiche(nicheId: string) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ active_niche_id: nicheId })
    .eq("id", profile.id);

  if (error) throwSafe("switchActiveNiche", error);

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
  if (!LEAD_STATUSES.has(status)) throw new Error("Ugyldig status.");
  const { profile, supabase } = await assertOwnsLead(leadId);

  const { error } = await supabase.from("leads").update({ status }).eq("id", leadId);
  if (error) throwSafe("updateLeadStatus", error);

  await supabase.from("lead_activities").insert({
    lead_id: leadId,
    seller_id: profile.id,
    type: "status_change" as ActivityType,
    content: `Status endret til "${LEAD_STATUS_LABELS[status]}".`,
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/today");
  revalidatePath("/dashboard");
}

export async function updateLeadFilmingStatus(
  leadId: string,
  filming_status: FilmingStatus
) {
  if (!FILMING_STATUSES.has(filming_status)) throw new Error("Ugyldig filming-status.");
  const { profile, supabase } = await assertOwnsLead(leadId);

  const { error } = await supabase
    .from("leads")
    .update({ filming_status })
    .eq("id", leadId);
  if (error) throwSafe("updateLeadFilmingStatus", error);

  await supabase.from("lead_activities").insert({
    lead_id: leadId,
    seller_id: profile.id,
    type: "filming_update" as ActivityType,
    content: `Filming-status endret til "${FILMING_STATUS_LABELS[filming_status]}".`,
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/today");
}

export async function updateLeadDetails(
  leadId: string,
  fields: { deal_size?: number | null; next_follow_up_at?: string | null }
) {
  const clean: { deal_size?: number | null; next_follow_up_at?: string | null } = {};

  if ("deal_size" in fields) {
    const value = fields.deal_size;
    if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 0)) {
      throw new Error("Deal size må være et positivt tall.");
    }
    clean.deal_size = value;
  }
  if ("next_follow_up_at" in fields) {
    const value = fields.next_follow_up_at;
    if (value !== null && Number.isNaN(new Date(value ?? "").getTime())) {
      throw new Error("Ugyldig oppfølgingsdato.");
    }
    clean.next_follow_up_at = value;
  }

  const { supabase } = await assertOwnsLead(leadId);

  const { error } = await supabase.from("leads").update(clean).eq("id", leadId);
  if (error) throwSafe("updateLeadDetails", error);

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/today");
}

/** Suggested follow-up: two days out, pushed to Monday if it lands on a weekend. */
function suggestedFollowUp(): string {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  d.setHours(9, 0, 0, 0);
  if (d.getDay() === 6) d.setDate(d.getDate() + 2); // Sat -> Mon
  else if (d.getDay() === 0) d.setDate(d.getDate() + 1); // Sun -> Mon
  return d.toISOString();
}

export async function addLeadActivity(
  leadId: string,
  type: ActivityType,
  content: string
) {
  if (!content.trim()) return;
  if (!ACTIVITY_TYPES.has(type)) throw new Error("Ugyldig aktivitetstype.");
  const trimmed = content.trim().slice(0, 2000);
  const { profile, supabase } = await assertOwnsLead(leadId);

  const { error } = await supabase.from("lead_activities").insert({
    lead_id: leadId,
    seller_id: profile.id,
    type,
    content: trimmed,
  });
  if (error) throwSafe("addLeadActivity", error);

  // Logging a call or an email auto-suggests a follow-up date (the seller can
  // still change it manually). Resetting the reminder timestamp ensures the
  // daily job sends a fresh reminder for the new date.
  if (type === "call" || type === "email") {
    await supabase
      .from("leads")
      .update({ next_follow_up_at: suggestedFollowUp(), follow_up_reminded_at: null })
      .eq("id", leadId);
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/today");
}
