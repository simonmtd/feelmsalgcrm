"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/dal";
import { throwSafe, safeError } from "@/lib/actions/errors";
import { enrichPerson } from "@/lib/apollo";
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

export interface LeadContactFields {
  company_name?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  industry?: string | null;
  job_title?: string | null;
}

/**
 * Lets a seller (own lead) or admin manually fill in / correct contact info —
 * e.g. add a phone number HubSpot didn't have. Runs through the service-role
 * client after verifying ownership, since RLS column grants otherwise block
 * sellers from editing contact fields.
 */
export async function updateLeadContact(leadId: string, fields: LeadContactFields) {
  const { supabase } = await assertOwnsLead(leadId);
  // assertOwnsLead already checked ownership; use it only for the check. The
  // write goes through the service-role client to bypass column-level grants.
  void supabase;

  const clean: Record<string, string | null> = {};
  const trim = (v: string | null | undefined) => {
    if (v === undefined) return undefined;
    const t = (v ?? "").trim();
    return t === "" ? null : t.slice(0, 300);
  };
  for (const key of [
    "company_name",
    "contact_name",
    "email",
    "phone",
    "website",
    "industry",
    "job_title",
  ] as const) {
    if (key in fields) {
      const value = trim(fields[key]);
      if (value !== undefined) clean[key] = value;
    }
  }
  if (Object.keys(clean).length === 0) return;

  const admin = createAdminClient();
  const { error } = await admin.from("leads").update(clean).eq("id", leadId);
  if (error) throwSafe("updateLeadContact", error);

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/today");
}

function splitName(name: string | null): { first: string | null; last: string | null } {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: null, last: null };
  if (parts.length === 1) return { first: parts[0], last: null };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

/** Strips a URL down to a bare domain (example.no) for Apollo's `domain` param. */
function toDomain(website: string | null): string | null {
  if (!website) return null;
  return (
    website
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split(/[/?#]/)[0]
      .trim() || null
  );
}

export interface EnrichResult {
  ok: boolean;
  filled: string[];
  phonePending: boolean;
  found: boolean;
  message: string;
}

/**
 * Fills a lead's missing contact info from Apollo (name + company lookup). Only
 * writes fields that are currently empty, so it never overwrites a seller's
 * manual entry. Consumes an Apollo credit, so it runs on demand from the lead
 * page. Mobile numbers may arrive shortly after via the phone webhook.
 */
export async function enrichLead(leadId: string): Promise<EnrichResult> {
  const { supabase } = await assertOwnsLead(leadId);

  const { data: lead, error: fetchErr } = await supabase
    .from("leads")
    .select("company_name, contact_name, email, phone, website, industry, job_title")
    .eq("id", leadId)
    .single();
  if (fetchErr || !lead) throw new Error("Fant ikke lead.");

  const { first, last } = splitName(lead.contact_name);

  let result;
  try {
    result = await enrichPerson({
      firstName: first,
      lastName: last,
      organizationName: lead.company_name,
      domain: toDomain(lead.website),
      email: lead.email,
    });
  } catch (err) {
    return {
      ok: false,
      filled: [],
      phonePending: false,
      found: false,
      message: safeError("enrichLead", err),
    };
  }

  // Fill-if-missing: only set a column the lead doesn't already have.
  const update: Record<string, string | null> = {
    apollo_person_id: result.apolloPersonId,
    enriched_at: new Date().toISOString(),
  };
  const filled: string[] = [];
  const maybe = (col: keyof typeof lead, value: string | null, label: string) => {
    if (!lead[col] && value) {
      update[col] = value;
      filled.push(label);
    }
  };
  maybe("email", result.email, "e-post");
  maybe("phone", result.phone, "telefon");
  maybe("website", result.website, "nettside");
  maybe("industry", result.industry, "bransje");
  maybe("job_title", result.jobTitle, "tittel");
  maybe("company_name", result.organizationName, "firma");

  const admin = createAdminClient();
  const { error } = await admin.from("leads").update(update).eq("id", leadId);
  if (error) throwSafe("enrichLead", error);

  const found = filled.length > 0 || result.phonePending;
  const message = !found
    ? "Apollo fant ingen ny informasjon."
    : `Fant: ${filled.join(", ") || "–"}${result.phonePending ? " (telefon hentes …)" : ""}.`;

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/today");

  return { ok: true, filled, phonePending: result.phonePending, found, message };
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
