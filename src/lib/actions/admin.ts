"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeError, throwSafe } from "@/lib/actions/errors";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { runHubspotSync } from "@/lib/jobs/sync-hubspot";
import { runDailyAssignment } from "@/lib/jobs/assign-daily-leads";
import {
  enrichPerson,
  splitName,
  toDomain,
  enrichmentUpdate,
  type LeadEnrichSnapshot,
} from "@/lib/apollo";
import { ENRICH_BATCH_MAX } from "@/lib/enrichment";

export interface FormActionState {
  error?: string;
  success?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createSeller(
  _prevState: FormActionState | undefined,
  formData: FormData
): Promise<FormActionState> {
  const actor = await requireAdmin();

  const email = String(formData.get("email") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "seller");

  if (!email || !password) {
    return { error: "E-post og passord er påkrevd." };
  }
  if (!EMAIL_RE.test(email)) {
    return { error: "Ugyldig e-postadresse." };
  }
  if (password.length < 8) {
    return { error: "Passordet må være minst 8 tegn." };
  }
  if (role !== "seller" && role !== "admin") {
    return { error: "Ugyldig rolle." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName || null, role },
  });

  if (error) {
    return { error: safeError("createSeller", error) };
  }

  await logAudit(actor, "seller.create", { targetType: "profile", details: { email, role } });
  revalidatePath("/admin/sellers");
  return { success: `${email} ble opprettet.` };
}

export async function resetSellerPassword(
  sellerId: string,
  newPassword: string
): Promise<{ error?: string; success?: string }> {
  const actor = await requireAdmin();
  if (newPassword.length < 8) return { error: "Passordet må være minst 8 tegn." };

  const supabase = createAdminClient();
  // Confirm the email at the same time — a user created without "Auto Confirm"
  // can't sign in even with a correct password until confirmed.
  const { error } = await supabase.auth.admin.updateUserById(sellerId, {
    password: newPassword,
    email_confirm: true,
  });
  if (error) return { error: safeError("resetSellerPassword", error) };

  await logAudit(actor, "seller.reset_password", { targetType: "profile", targetId: sellerId });
  return { success: "Nytt passord satt." };
}

export async function setSellerActive(sellerId: string, isActive: boolean) {
  const actor = await requireAdmin();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", sellerId);
  if (error) throwSafe("setSellerActive", error);

  await logAudit(actor, isActive ? "seller.activate" : "seller.deactivate", {
    targetType: "profile",
    targetId: sellerId,
  });
  revalidatePath("/admin/sellers");
}

export async function createNiche(
  _prevState: FormActionState | undefined,
  formData: FormData
): Promise<FormActionState> {
  const actor = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  if (!name) return { error: "Navn er påkrevd." };

  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  if (!slug) return { error: "Navnet må inneholde minst én bokstav eller tall." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("niches").insert({ name, slug });
  if (error) return { error: safeError("createNiche", error) };

  await logAudit(actor, "niche.create", { targetType: "niche", details: { name } });
  revalidatePath("/admin/niches");
  return { success: `Niche "${name}" ble opprettet.` };
}

/** Fields written when a lead is handed to a seller (or pulled back into the pool). */
function assignmentFields(sellerId: string | null) {
  return {
    assigned_to: sellerId,
    status: sellerId ? "assigned" : "new",
    assigned_date: sellerId ? new Date().toISOString().slice(0, 10) : null,
  };
}

/** The seller-facing pages read the same rows, so they must be revalidated too. */
function revalidateLeadViews() {
  revalidatePath("/admin/leads");
  revalidatePath("/leads");
  revalidatePath("/dashboard");
}

export async function reassignLead(leadId: string, sellerId: string | null) {
  const actor = await requireAdmin();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("leads")
    .update(assignmentFields(sellerId))
    .eq("id", leadId);
  if (error) throwSafe("reassignLead", error);

  await logAudit(actor, "lead.reassign", {
    targetType: "lead",
    targetId: leadId,
    details: { sellerId },
  });
  if (sellerId) {
    await notify(sellerId, "Du har fått tildelt en ny lead.", {
      type: "lead_reassigned",
      leadId,
    });
  }
  revalidateLeadViews();
}

export interface BulkAssignResult {
  assigned: number;
  error?: string;
}

/** Assigns many leads to one seller in a single write — used by the bulk bar on /admin/leads. */
export async function bulkAssignLeads(
  leadIds: string[],
  sellerId: string | null
): Promise<BulkAssignResult> {
  const actor = await requireAdmin();
  if (!leadIds.length) return { assigned: 0, error: "Ingen leads er valgt." };
  if (leadIds.length > 500) return { assigned: 0, error: "Maks 500 leads om gangen." };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("leads")
    .update(assignmentFields(sellerId))
    .in("id", leadIds)
    .select("id");

  if (error) return { assigned: 0, error: safeError("bulkAssignLeads", error) };

  const count = data?.length ?? 0;
  await logAudit(actor, "lead.bulk_assign", {
    targetType: "lead",
    details: { count, sellerId },
  });
  if (sellerId && count > 0) {
    await notify(sellerId, `Du har fått ${count} ${count === 1 ? "ny lead" : "nye leads"} tildelt.`);
  }
  revalidateLeadViews();
  return { assigned: count };
}

/** Round-robin distributes selected leads evenly across the given sellers. */
export async function distributeLeadsEvenly(
  leadIds: string[],
  sellerIds: string[]
): Promise<BulkAssignResult> {
  const actor = await requireAdmin();
  if (!leadIds.length) return { assigned: 0, error: "Ingen leads er valgt." };
  if (!sellerIds.length) return { assigned: 0, error: "Ingen selgere å fordele til." };
  if (leadIds.length > 500) return { assigned: 0, error: "Maks 500 leads om gangen." };

  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  // Group leads round-robin, then one UPDATE per seller.
  const buckets = new Map<string, string[]>();
  leadIds.forEach((leadId, i) => {
    const sellerId = sellerIds[i % sellerIds.length];
    const bucket = buckets.get(sellerId) ?? [];
    bucket.push(leadId);
    buckets.set(sellerId, bucket);
  });

  let assigned = 0;
  for (const [sellerId, ids] of buckets) {
    const { data, error } = await supabase
      .from("leads")
      .update({ assigned_to: sellerId, status: "assigned", assigned_date: today })
      .in("id", ids)
      .select("id");
    if (error) return { assigned, error: safeError("distributeLeadsEvenly", error) };
    const count = data?.length ?? 0;
    assigned += count;
    if (count > 0) {
      await notify(sellerId, `Du har fått ${count} ${count === 1 ? "ny lead" : "nye leads"} tildelt.`);
    }
  }

  await logAudit(actor, "lead.bulk_assign", {
    targetType: "lead",
    details: { count: assigned, distributed: true, sellers: sellerIds.length },
  });
  revalidateLeadViews();
  return { assigned };
}

export async function classifyLeadNiche(leadId: string, nicheId: string) {
  const actor = await requireAdmin();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("leads")
    .update({ niche_id: nicheId })
    .eq("id", leadId);
  if (error) throwSafe("classifyLeadNiche", error);

  await logAudit(actor, "lead.classify", {
    targetType: "lead",
    targetId: leadId,
    details: { nicheId },
  });
  revalidatePath("/admin/leads");
}

export async function updateDailyLeadCount(value: number) {
  const actor = await requireAdmin();
  if (!Number.isInteger(value) || value < 0 || value > 1000) {
    throw new Error("Antall må være et heltall mellom 0 og 1000.");
  }
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("app_settings")
    .update({ value })
    .eq("key", "daily_lead_count");
  if (error) throwSafe("updateDailyLeadCount", error);

  await logAudit(actor, "settings.daily_lead_count", {
    targetType: "setting",
    details: { value },
  });
  revalidatePath("/admin/settings");
}

export async function triggerHubspotSync() {
  const actor = await requireAdmin();
  const result = await runHubspotSync();
  await logAudit(actor, "sync.trigger", {
    details: { recordsSynced: result.recordsSynced, ok: result.ok },
  });
  revalidatePath("/admin/sync");
  return result;
}

export async function triggerDailyAssignment() {
  const actor = await requireAdmin();
  const result = await runDailyAssignment();
  const assigned = Object.values(result.assignments).reduce((sum, n) => sum + n, 0);
  await logAudit(actor, "assignment.trigger", { details: { assigned } });
  revalidatePath("/admin/leads");
  return result;
}

export interface EnrichBatchResult {
  ok: boolean;
  processed: number;
  phonePending: number;
  filled: Record<string, number>;
  message: string;
}

/**
 * Admin bulk enrichment: fills contact info on up to ENRICH_BATCH_MAX leads that
 * are missing a phone number, via Apollo. `scope` "assigned" only touches leads
 * already handed to a seller (so credits aren't spent on the backlog nobody is
 * working); "all" prioritises assigned leads first. Fill-if-missing, so manual
 * entries are never overwritten. Phone numbers arrive shortly after via the
 * phone webhook. Each processed lead can cost ~8 Apollo credits.
 */
export async function enrichLeadsBatch(input: {
  scope: "all" | "assigned";
  limit: number;
}): Promise<EnrichBatchResult> {
  const actor = await requireAdmin();
  const scope = input.scope === "assigned" ? "assigned" : "all";
  const limit = Math.max(1, Math.min(ENRICH_BATCH_MAX, Math.floor(input.limit) || 0));

  const admin = createAdminClient();
  type BatchRow = LeadEnrichSnapshot & { id: string; contact_name: string | null };

  // Two independent, fully-chained queries (rather than reassigning or unioning
  // builders, which trips TS2589). Both fetch leads missing a phone that still
  // have a name to match on; "assigned" additionally requires a seller.
  // assigned_to desc prioritises worked leads first even in "all" scope.
  let rows: BatchRow[];
  if (scope === "assigned") {
    const { data, error } = await admin
      .from("leads")
      .select("*")
      .is("phone", null)
      .not("contact_name", "is", null)
      .not("assigned_to", "is", null)
      .order("assigned_to", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) throwSafe("enrichLeadsBatch", error);
    rows = (data ?? []) as BatchRow[];
  } else {
    const { data, error } = await admin
      .from("leads")
      .select("*")
      .is("phone", null)
      .not("contact_name", "is", null)
      .order("assigned_to", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) throwSafe("enrichLeadsBatch", error);
    rows = (data ?? []) as BatchRow[];
  }
  let processed = 0;
  let phonePending = 0;
  const filled: Record<string, number> = {};

  for (const lead of rows) {
    try {
      const { first, last } = splitName(lead.contact_name);
      const result = await enrichPerson({
        firstName: first,
        lastName: last,
        organizationName: lead.company_name,
        domain: toDomain(lead.website),
        email: lead.email,
      });
      const { update, filled: fills } = enrichmentUpdate(lead, result);
      update.apollo_person_id = result.apolloPersonId;
      update.enriched_at = new Date().toISOString();
      await admin.from("leads").update(update).eq("id", lead.id);
      processed++;
      if (result.phonePending) phonePending++;
      for (const f of fills) filled[f] = (filled[f] ?? 0) + 1;
    } catch (err) {
      // One bad lead shouldn't abort the whole batch.
      console.error("[enrichLeadsBatch] lead failed", lead.id, err);
    }
  }

  await logAudit(actor, "leads.enrich_batch", {
    details: { scope, limit, processed, phonePending },
  });

  revalidatePath("/admin/leads");
  revalidatePath("/leads");
  revalidatePath("/today");

  const parts = Object.entries(filled).map(([k, v]) => `${v} ${k}`);
  const message =
    processed === 0
      ? "Fant ingen leads uten telefon å berike."
      : `Beriket ${processed} leads.${parts.length ? " Fylte: " + parts.join(", ") + "." : ""}${
          phonePending ? ` Telefon hentes for ${phonePending} (dukker opp om litt).` : ""
        }`;

  return { ok: true, processed, phonePending, filled, message };
}
