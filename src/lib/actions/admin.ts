"use server";

import { revalidatePath, refresh } from "next/cache";
import { requireAdmin } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeError, throwSafe } from "@/lib/actions/errors";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { runHubspotSync } from "@/lib/jobs/sync-hubspot";
import { runDailyAssignment } from "@/lib/jobs/assign-daily-leads";
import { runApolloLeadFetch } from "@/lib/jobs/fetch-apollo-leads";
import {
  enrichPerson,
  splitName,
  toDomain,
  enrichmentUpdate,
  APOLLO_NO_CREDITS,
  type LeadEnrichSnapshot,
} from "@/lib/apollo";
import { ENRICH_BATCH_MAX } from "@/lib/enrichment";
import { matchNiche } from "@/lib/niche-matcher";
import { normEmail } from "@/lib/dedup";
import { expandTitles, areaToLocations, validEmployeeRange } from "@/lib/prospecting";
import type { Niche } from "@/lib/types";

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
  type BatchRow = LeadEnrichSnapshot & {
    id: string;
    contact_name: string | null;
    apollo_person_id: string | null;
    niche_id: string | null;
  };

  // We can enrich a lead that has EITHER a name to match on OR an Apollo id
  // (leads imported from Apollo have masked names but a stable id).
  const matchable = "contact_name.not.is.null,apollo_person_id.not.is.null";

  // Two independent, fully-chained queries (rather than reassigning or unioning
  // builders, which trips TS2589). "assigned" additionally requires a seller.
  // assigned_to desc prioritises worked leads first even in "all" scope.
  let rows: BatchRow[];
  if (scope === "assigned") {
    const { data, error } = await admin
      .from("leads")
      .select("*")
      .is("phone", null)
      .or(matchable)
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
      .or(matchable)
      .order("assigned_to", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) throwSafe("enrichLeadsBatch", error);
    rows = (data ?? []) as BatchRow[];
  }

  const { data: nichesData } = await admin.from("niches").select("*");
  const niches = (nichesData as Niche[] | null) ?? [];

  let processed = 0;
  let phonePending = 0;
  let duplicates = 0;
  let noCredits = false;
  const filled: Record<string, number> = {};

  for (const lead of rows) {
    try {
      const { first, last } = splitName(lead.contact_name);
      const result = await enrichPerson({
        apolloId: lead.apollo_person_id,
        firstName: first,
        lastName: last,
        organizationName: lead.company_name,
        domain: toDomain(lead.website),
        email: lead.email,
      });
      const { update, filled: fills } = enrichmentUpdate(lead, result);
      update.apollo_person_id = result.apolloPersonId ?? lead.apollo_person_id;
      update.enriched_at = new Date().toISOString();
      if (!lead.niche_id) {
        const niche = matchNiche(niches, {
          company: lead.company_name ?? result.organizationName,
          industry: lead.industry ?? result.industry,
          website: lead.website ?? result.website,
          title: lead.job_title ?? result.jobTitle,
        });
        if (niche) update.niche_id = niche.id;
      }
      // Cross-source dedup on a newly-revealed email.
      const newEmail = normEmail(update.email as string | undefined);
      if (newEmail) {
        const { data: dup } = await admin
          .from("leads")
          .select("id")
          .neq("id", lead.id)
          .ilike("email", newEmail)
          .is("duplicate_of", null)
          .limit(1)
          .maybeSingle();
        if (dup) {
          update.status = "lost";
          update.duplicate_of = dup.id;
          duplicates++;
        }
      }
      await admin.from("leads").update(update).eq("id", lead.id);
      processed++;
      if (result.phonePending) phonePending++;
      for (const f of fills) filled[f] = (filled[f] ?? 0) + 1;
    } catch (err) {
      // Out of Apollo credits: stop the whole batch (every further call fails).
      if (err instanceof Error && err.message === APOLLO_NO_CREDITS) {
        noCredits = true;
        break;
      }
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
  // Called programmatically from the enrich panel — refresh the client router so
  // the updated contact info appears in the list without a manual reload.
  refresh();

  const parts = Object.entries(filled).map(([k, v]) => `${v} ${k}`);
  const message = noCredits
    ? `Apollo er tom for credits — stoppet etter ${processed} leads. Fyll på i Apollo for å fortsette.`
    : processed === 0
      ? "Fant ingen leads uten telefon å berike."
      : `Beriket ${processed} leads.${parts.length ? " Fylte: " + parts.join(", ") + "." : ""}${
          phonePending ? ` Telefon hentes for ${phonePending} (dukker opp om litt).` : ""
        }${duplicates ? ` ${duplicates} duplikat markert tapt.` : ""}`;

  return { ok: true, processed, phonePending, filled, message };
}

/**
 * Turns a niche name into a single strong search keyword for Apollo's
 * q_keywords. A multi-word phrase ("Bygg & Anlegg") over-narrows, so we drop
 * filler words (og, &, i, på) and short tokens and take the first meaningful
 * one ("bygg"). Falls back to the whole lowercased name.
 */
function industryKeyword(name: string): string {
  const STOP = new Set(["og", "i", "på", "for", "med", "til", "av"]);
  const words = name
    .toLowerCase()
    .split(/[^a-zæøå0-9]+/i)
    .filter((w) => w.length >= 3 && !STOP.has(w));
  return words[0] ?? name.toLowerCase().trim();
}

export interface ApolloFetchActionResult {
  ok: boolean;
  imported: number;
  autoClassified: number;
  message: string;
}

/**
 * Admin-triggered version of the daily Apollo prospecting import. Pulls fresh
 * ICP-matched prospects into the pool (deduped, auto-classified). Contact info
 * stays masked until enriched — import itself spends no reveal credits.
 */
export interface FetchApolloInput {
  count?: number;
  nicheId?: string | null;
  titleKeys?: string[];
  employeeRange?: string | null;
  area?: string | null;
}

export async function fetchApolloLeads(
  input: FetchApolloInput = {}
): Promise<ApolloFetchActionResult> {
  const actor = await requireAdmin();
  const limit = Math.max(1, Math.min(100, Math.floor(input.count ?? 25) || 0));

  // If a bransje was chosen, look it up and search Apollo for that keyword,
  // tagging every import with that niche.
  let keywords: string | undefined;
  let validNicheId: string | null = null;
  if (input.nicheId) {
    const admin = createAdminClient();
    const { data: niche } = await admin
      .from("niches")
      .select("id, name")
      .eq("id", input.nicheId)
      .maybeSingle();
    if (niche) {
      validNicheId = niche.id as string;
      keywords = industryKeyword(String(niche.name));
    }
  }

  const result = await runApolloLeadFetch(limit, {
    keywords,
    nicheId: validNicheId,
    titles: expandTitles(input.titleKeys ?? []),
    locations: areaToLocations(input.area),
    employeeRanges: validEmployeeRange(input.employeeRange)
      ? [validEmployeeRange(input.employeeRange)!]
      : undefined,
  });

  await logAudit(actor, "leads.apollo_fetch", {
    details: {
      imported: result.imported,
      autoClassified: result.autoClassified,
      nicheId: validNicheId,
    },
  });
  revalidatePath("/admin/leads");
  revalidatePath("/dashboard");
  // This action is called programmatically from the panel (not via a form), so
  // revalidatePath alone doesn't reliably re-render the current view. refresh()
  // forces the client router to re-fetch, so the freshly imported leads show up
  // at the top of the list right away.
  refresh();

  const filteredParts = [
    result.rejectedForeign ? `${result.rejectedForeign} ikke-norske` : "",
    result.rejectedDuplicate ? `${result.rejectedDuplicate} duplikater` : "",
  ].filter(Boolean);
  const foreignNote = filteredParts.length ? ` (${filteredParts.join(" + ")} filtrert bort)` : "";
  const message = !result.ok
    ? "Kunne ikke hente leads fra Apollo akkurat nå."
    : result.imported === 0
      ? `Ingen nye norske leads å hente${foreignNote}.`
      : `Hentet ${result.imported} nye norske leads${
          result.autoClassified ? `, ${result.autoClassified} auto-klassifisert` : ""
        }${foreignNote}. Berik dem for å låse opp kontaktinfo.`;

  return {
    ok: result.ok,
    imported: result.imported,
    autoClassified: result.autoClassified,
    message,
  };
}
