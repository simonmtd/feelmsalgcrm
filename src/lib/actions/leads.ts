"use server";

import { revalidatePath, refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/dal";
import { throwSafe, safeError } from "@/lib/actions/errors";
import { enrichPerson, splitName, toDomain, enrichmentUpdate, APOLLO_NO_CREDITS } from "@/lib/apollo";
import { matchNiche } from "@/lib/niche-matcher";
import { normEmail } from "@/lib/dedup";
import type { Niche } from "@/lib/types";
import {
  LEAD_STATUS_LABELS,
  FILMING_STATUS_LABELS,
  ACTIVITY_TYPE_LABELS,
  CALL_OUTCOME_LABELS,
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

/** Next business morning at 09:00 — for a quick retry after "no answer". */
function nextBusinessMorning(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  if (d.getDay() === 6) d.setDate(d.getDate() + 2); // Sat -> Mon
  else if (d.getDay() === 0) d.setDate(d.getDate() + 1); // Sun -> Mon
  return d.toISOString();
}

export type CallOutcome =
  | "no_answer"
  | "voicemail"
  | "not_interested"
  | "interested"
  | "meeting_booked";

/**
 * A logged call outcome maps to: an activity note, a new lead status, and a
 * follow-up timing rule. "standard" = +2 business days, "soon" = next business
 * morning (retry), "none" = clear the follow-up.
 */
const CALL_OUTCOMES: Record<
  CallOutcome,
  { note: string; status: LeadStatus; followUp: "standard" | "soon" | "none" }
> = {
  // Any registered call outcome (even "ikke svar") means the lead has been
  // contacted, so it lands on status "Kontaktet" — never silently under "Følges
  // opp". The follow-up *timing* still drives when it resurfaces: "soon" = retry
  // next morning, "standard" = +2 business days, "none" = clear the follow-up.
  no_answer: { note: "Ringte – ikke svar", status: "contacted", followUp: "soon" },
  voicemail: { note: "La igjen beskjed", status: "contacted", followUp: "standard" },
  not_interested: { note: "Ikke interessert", status: "lost", followUp: "none" },
  interested: { note: "Interessert – følg opp", status: "contacted", followUp: "standard" },
  meeting_booked: { note: "Møte booket", status: "contacted", followUp: "none" },
};

/**
 * One-click call disposition: records the call, updates the lead's status, and
 * sets (or clears) the next follow-up date — all in one action, so a seller
 * working the phone doesn't have to touch three separate controls per call.
 */
export async function logCallOutcome(leadId: string, outcome: CallOutcome) {
  const cfg = CALL_OUTCOMES[outcome];
  if (!cfg) throw new Error("Ugyldig samtaleutfall.");
  const { profile, supabase } = await assertOwnsLead(leadId);

  const { error: actErr } = await supabase.from("lead_activities").insert({
    lead_id: leadId,
    seller_id: profile.id,
    type: "call" as ActivityType,
    content: cfg.note,
  });
  if (actErr) throwSafe("logCallOutcome", actErr);

  const next_follow_up_at =
    cfg.followUp === "standard"
      ? suggestedFollowUp()
      : cfg.followUp === "soon"
        ? nextBusinessMorning()
        : null;

  // follow_up_reminded_at isn't in the seller column grant (migration 0004), so
  // this write goes through the service-role client. Ownership already verified.
  const admin = createAdminClient();
  const { error } = await admin
    .from("leads")
    .update({ status: cfg.status, next_follow_up_at, follow_up_reminded_at: null })
    .eq("id", leadId);
  if (error) throwSafe("logCallOutcome", error);

  // Track the call for the dashboard activity/hit-rate stats.
  const { data: leadInfo } = await supabase
    .from("leads")
    .select("company_name, phone")
    .eq("id", leadId)
    .maybeSingle();
  await supabase.from("call_logs").insert({
    seller_id: profile.id,
    lead_id: leadId,
    company_name: leadInfo?.company_name ?? null,
    phone: leadInfo?.phone ?? null,
    outcome,
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/today");
  revalidatePath("/dashboard");
  refresh();
}

export interface CallFormState {
  error?: string;
  success?: string;
}

/**
 * Logs a cold call to a company that isn't in the lead list — the seller types
 * the number and company, and it's tracked the same way as a lead call so it
 * counts toward their activity/hit-rate stats.
 */
export async function logManualCall(
  _prevState: CallFormState | undefined,
  formData: FormData
): Promise<CallFormState> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const phone = String(formData.get("phone") ?? "").trim().slice(0, 40);
  const company = String(formData.get("company") ?? "").trim().slice(0, 200);
  const outcomeRaw = String(formData.get("outcome") ?? "").trim();
  const outcome = (CALL_OUTCOME_LABELS as Record<string, string>)[outcomeRaw] ? outcomeRaw : null;

  if (!phone && !company) {
    return { error: "Fyll inn telefonnummer eller bedrift." };
  }

  const { error } = await supabase.from("call_logs").insert({
    seller_id: profile.id,
    lead_id: null,
    company_name: company || null,
    phone: phone || null,
    outcome,
  });
  if (error) return { error: safeError("logManualCall", error) };

  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath("/today");
  refresh();
  return { success: `Samtale registrert${company ? ` – ${company}` : ""}.` };
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
    .select("company_name, contact_name, email, phone, website, industry, job_title, apollo_person_id, niche_id")
    .eq("id", leadId)
    .single();
  if (fetchErr || !lead) throw new Error("Fant ikke lead.");

  const { first, last } = splitName(lead.contact_name);

  let result;
  try {
    result = await enrichPerson({
      // Prefer an exact Apollo id (leads imported from Apollo have masked names).
      apolloId: lead.apollo_person_id,
      firstName: first,
      lastName: last,
      organizationName: lead.company_name,
      domain: toDomain(lead.website),
      email: lead.email,
    });
  } catch (err) {
    const noCredits = err instanceof Error && err.message === APOLLO_NO_CREDITS;
    return {
      ok: false,
      filled: [],
      phonePending: false,
      found: false,
      message: noCredits
        ? "Apollo er tom for credits — fyll på i Apollo for å berike flere leads."
        : safeError("enrichLead", err),
    };
  }

  // Fill-if-missing: only set a column the lead doesn't already have.
  const { update, filled } = enrichmentUpdate(lead, result);
  update.apollo_person_id = result.apolloPersonId ?? lead.apollo_person_id;
  update.enriched_at = new Date().toISOString();

  // If still unclassified, try to match a niche now that enrichment may have
  // added industry/website (important for Apollo-imported leads).
  if (!lead.niche_id) {
    const { data: nichesData } = await supabase.from("niches").select("*");
    const niche = matchNiche((nichesData as Niche[] | null) ?? [], {
      company: lead.company_name ?? result.organizationName,
      industry: lead.industry ?? result.industry,
      website: lead.website ?? result.website,
      title: lead.job_title ?? result.jobTitle,
    });
    if (niche) update.niche_id = niche.id;
  }

  const admin = createAdminClient();

  // Cross-source dedup: if enrichment just revealed an email that another lead
  // already has, this (newly-emailed, usually Apollo-sourced) lead is the
  // duplicate — flag it and drop it out of the pipeline so no one double-works
  // the same person.
  let duplicateNote: string | null = null;
  const newEmail = normEmail(update.email as string | undefined);
  if (newEmail) {
    const { data: dup } = await admin
      .from("leads")
      .select("id, company_name")
      .neq("id", leadId)
      .ilike("email", newEmail)
      .is("duplicate_of", null)
      .limit(1)
      .maybeSingle();
    if (dup) {
      update.status = "lost";
      update.duplicate_of = dup.id;
      duplicateNote = `Duplikat av eksisterende lead (${dup.company_name ?? "kjent kunde"}).`;
    }
  }

  const { error } = await admin.from("leads").update(update).eq("id", leadId);
  if (error) throwSafe("enrichLead", error);

  if (duplicateNote) {
    await admin.from("lead_activities").insert({
      lead_id: leadId,
      seller_id: null,
      type: "note" as ActivityType,
      content: `${duplicateNote} Markert som tapt automatisk.`,
    });
  }

  const found = filled.length > 0 || result.phonePending;
  const message = duplicateNote
    ? `⚠️ ${duplicateNote} Markert tapt.`
    : !found
      ? "Apollo fant ingen ny informasjon."
      : `Fant: ${filled.join(", ") || "–"}${result.phonePending ? " (telefon hentes …)" : ""}.`;

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/today");
  revalidatePath("/dashboard");

  return { ok: true, filled, phonePending: result.phonePending, found, message };
}

export interface LeadFormState {
  error?: string;
  success?: string;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Lets a seller (or admin) add a lead they sourced themselves from the /leads
 * page. The lead is assigned to the creator and marked "Tildelt" so it lands in
 * their own pipeline right away. Writes through the service-role client — sellers
 * have no INSERT grant on leads (migration 0004) — after verifying the caller is
 * an active profile. Mirrors the manual-lead insert in createMeeting.
 */
export async function createLead(
  _prevState: LeadFormState | undefined,
  formData: FormData
): Promise<LeadFormState> {
  const profile = await requireProfile();

  const company = String(formData.get("company_name") ?? "").trim().slice(0, 200);
  const contact = String(formData.get("contact_name") ?? "").trim().slice(0, 200) || null;
  const email = String(formData.get("email") ?? "").trim().slice(0, 200) || null;
  const phone = String(formData.get("phone") ?? "").trim().slice(0, 50) || null;
  const nicheId = String(formData.get("niche_id") ?? "").trim() || null;

  if (!company) return { error: "Firmanavn er påkrevd." };
  if (email && !EMAIL_RE.test(email)) return { error: "Ugyldig e-postadresse." };

  const admin = createAdminClient();
  const { data: created, error } = await admin
    .from("leads")
    .insert({
      company_name: company,
      contact_name: contact,
      email,
      phone,
      niche_id: nicheId,
      source: "manual",
      status: "assigned",
      assigned_to: profile.id,
      assigned_date: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();
  if (error) return { error: safeError("createLead", error) };

  if (created?.id) {
    await admin.from("lead_activities").insert({
      lead_id: created.id,
      seller_id: profile.id,
      type: "note" as ActivityType,
      content: "Lead opprettet manuelt.",
    });
  }

  revalidatePath("/leads");
  revalidatePath("/today");
  revalidatePath("/dashboard");
  return { success: `«${company}» ble lagt til i leadsene dine.` };
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
    // follow_up_reminded_at isn't seller-grantable (migration 0004), so write
    // via the service-role client. Ownership was verified by assertOwnsLead.
    const admin = createAdminClient();
    await admin
      .from("leads")
      .update({ next_follow_up_at: suggestedFollowUp(), follow_up_reminded_at: null })
      .eq("id", leadId);
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/today");
}
