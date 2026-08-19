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
import { type LeadEnrichSnapshot, norwegianPhone } from "@/lib/apollo";
import { ENRICH_BATCH_MAX } from "@/lib/enrichment";
import { enrichLeadRows, type EnrichableLead } from "@/lib/jobs/enrich-leads";
import { expandTitles, areaToLocations, validEmployeeRange, nicheKeywordTags } from "@/lib/prospecting";
import { matchNiche } from "@/lib/niche-matcher";
import { normEmail, companyTitleKey, companyContactKey, mobileKey } from "@/lib/dedup";
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
  // These actions run programmatically from client components, where
  // revalidatePath alone doesn't re-render the current view — refresh() forces
  // the client router to re-fetch (so a reassigned lead leaves the list at once).
  refresh();
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

  const { processed, phonePending, duplicates, filled, noCredits } =
    await enrichLeadRows(admin, rows, niches);

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

export interface ApolloFetchActionResult {
  ok: boolean;
  imported: number;
  autoClassified: number;
  /** How many of the imported leads got auto-enriched this run (0 if disabled). */
  enriched: number;
  message: string;
}

/**
 * Admin-triggered version of the daily Apollo prospecting import. Pulls fresh
 * ICP-matched prospects into the pool (deduped, auto-classified). Import itself
 * spends no credits; when `autoEnrich` is on (default) the freshly imported
 * leads are revealed right away (~8 credits/lead, capped at ENRICH_BATCH_MAX per
 * run so one click can't burn thousands of credits).
 */
export interface FetchApolloInput {
  count?: number;
  nicheId?: string | null;
  titleKeys?: string[];
  employeeRange?: string | null;
  area?: string | null;
  /** Reveal contact info on the imported leads immediately. Defaults to true. */
  autoEnrich?: boolean;
}

export async function fetchApolloLeads(
  input: FetchApolloInput = {}
): Promise<ApolloFetchActionResult> {
  const actor = await requireAdmin();
  const limit = Math.max(1, Math.min(100, Math.floor(input.count ?? 25) || 0));

  // If a bransje was chosen, look it up and search Apollo on that industry's
  // keyword-tags (not the company name), tagging every import with that niche.
  let keywordTags: string[] | undefined;
  let validNicheId: string | null = null;
  if (input.nicheId) {
    const admin = createAdminClient();
    const { data: niche } = await admin
      .from("niches")
      .select("id, name, slug")
      .eq("id", input.nicheId)
      .maybeSingle();
    if (niche) {
      validNicheId = niche.id as string;
      keywordTags = nicheKeywordTags(String(niche.slug), String(niche.name));
    }
  }

  const result = await runApolloLeadFetch(limit, {
    keywordTags,
    nicheId: validNicheId,
    titles: expandTitles(input.titleKeys ?? []),
    locations: areaToLocations(input.area),
    employeeRanges: validEmployeeRange(input.employeeRange)
      ? [validEmployeeRange(input.employeeRange)!]
      : undefined,
  });

  // Auto-berik de nyimporterte leadsene med en gang (med mindre eksplisitt av).
  // Reveal koster ~8 credits/lead, så vi holder oss innenfor samme sikkerhets-
  // grense som bulk-berikelsen (ENRICH_BATCH_MAX) per henting; importerer man
  // flere, berikes de første og resten kan tas via «Berik».
  const autoEnrich = input.autoEnrich !== false;
  let enriched = 0;
  let enrichPending = 0;
  let enrichLeft = 0;
  let enrichNoCredits = false;
  if (autoEnrich && result.insertedIds.length > 0) {
    const admin = createAdminClient();
    const toEnrich = result.insertedIds.slice(0, ENRICH_BATCH_MAX);
    enrichLeft = result.insertedIds.length - toEnrich.length;
    const { data: rows } = await admin
      .from("leads")
      .select("*")
      .in("id", toEnrich)
      .is("phone", null);
    const { data: nichesData } = await admin.from("niches").select("*");
    const stats = await enrichLeadRows(
      admin,
      (rows ?? []) as EnrichableLead[],
      (nichesData as Niche[] | null) ?? []
    );
    enriched = stats.processed;
    enrichPending = stats.phonePending;
    enrichNoCredits = stats.noCredits;
  }

  await logAudit(actor, "leads.apollo_fetch", {
    details: {
      imported: result.imported,
      autoClassified: result.autoClassified,
      enriched,
      nicheId: validNicheId,
    },
  });
  revalidatePath("/admin/leads");
  revalidatePath("/dashboard");
  // This action is called programmatically from the panel (not via a form), so
  // revalidatePath alone doesn't reliably re-render the current view. refresh()
  // forces the client router to re-fetch, so the freshly imported (and enriched)
  // leads show up at the top of the list right away.
  refresh();

  const filteredParts = [
    result.rejectedForeign ? `${result.rejectedForeign} ikke-norske` : "",
    result.rejectedDuplicate ? `${result.rejectedDuplicate} duplikater` : "",
    result.rejectedSameCompany ? `${result.rejectedSameCompany} fra firma vi alt har` : "",
    result.alreadyHave ? `${result.alreadyHave} alt importert` : "",
  ].filter(Boolean);
  const foreignNote = filteredParts.length ? ` (${filteredParts.join(" + ")} hoppet over)` : "";

  // Suffix som forklarer berikelsen (eller at den er skrudd av).
  let enrichNote: string;
  if (!autoEnrich) {
    enrichNote = " Berik dem for å låse opp kontaktinfo.";
  } else if (enrichNoCredits) {
    enrichNote = ` Berikelse stoppet – Apollo er tom for credits (beriket ${enriched} før det stoppet).`;
  } else {
    enrichNote =
      ` Beriket ${enriched}${enrichPending ? `, ${enrichPending} venter telefon` : ""}.` +
      (enrichLeft ? ` ${enrichLeft} gjenstår – bruk «Berik» for resten.` : "");
  }

  // When nothing new came in, say WHY: an exhausted pool (all matches already
  // imported) is very different from Apollo genuinely having no one.
  const emptyMessage = result.alreadyHave
    ? `Ingen nye leads – alle ${result.alreadyHave} Apollo-treffene for dette søket er allerede importert. Prøv en annen bransje eller et bredere område (f.eks. Hele Norge).`
    : `Apollo hadde ingen treff for dette søket${foreignNote}. Prøv en annen bransje eller et bredere område.`;

  const message = !result.ok
    ? "Kunne ikke hente leads fra Apollo akkurat nå."
    : result.imported === 0
      ? emptyMessage
      : `Hentet ${result.imported} nye norske leads${
          result.autoClassified ? `, ${result.autoClassified} auto-klassifisert` : ""
        }${foreignNote}.${enrichNote}`;

  return {
    ok: result.ok,
    imported: result.imported,
    autoClassified: result.autoClassified,
    enriched,
    message,
  };
}

export interface ImportLeadRow {
  company_name?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  industry?: string | null;
  job_title?: string | null;
  apollo_person_id?: string | null;
}

export interface ImportLeadsResult {
  ok: boolean;
  imported: number;
  skipped: number;
  /** DB ids of the leads created this import, so the UI can pre-select them. */
  insertedIds: string[];
  message: string;
}

/** Max rows processed per CSV import — keeps the insert + payload bounded. */
const IMPORT_MAX = 2000;

function cleanField(v: string | null | undefined, max = 300): string | null {
  const t = (v ?? "").trim();
  return t ? t.slice(0, max) : null;
}

/**
 * Imports already-enriched leads from an Apollo.io CSV export (parsed to rows on
 * the client). Contact info (phone/email/company/title) comes straight from the
 * file — no Apollo credits spent. Foreign phone numbers are dropped, leads are
 * deduped against what we already have (Apollo id / email / company+role), and
 * each gets an auto-matched niche. Imported into the unassigned pool as `new`
 * so the admin distributes them with the normal bulk-assign flow.
 */
export async function importApolloLeads(
  rows: ImportLeadRow[],
  opts: { requirePhone?: boolean } = {}
): Promise<ImportLeadsResult> {
  const actor = await requireAdmin();
  const requirePhone = opts.requirePhone !== false; // default: skip no-phone leads
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, imported: 0, skipped: 0, insertedIds: [], message: "Fant ingen rader i filen." };
  }
  const capped = rows.slice(0, IMPORT_MAX);
  const admin = createAdminClient();

  // Dedup against EVERY existing lead (any source, any status) on several keys,
  // so a re-import is caught even if just one of them matches: Apollo id, email,
  // company+contact, company+title, or a Norwegian mobile number.
  const { data: existing } = await admin
    .from("leads")
    .select("apollo_person_id, email, company_name, contact_name, job_title, phone");
  const seenApollo = new Set<string>();
  const seenEmail = new Set<string>();
  const seenTitleSig = new Set<string>();
  const seenContactSig = new Set<string>();
  const seenMobile = new Set<string>();
  for (const r of (existing as {
    apollo_person_id: string | null;
    email: string | null;
    company_name: string | null;
    contact_name: string | null;
    job_title: string | null;
    phone: string | null;
  }[] | null) ?? []) {
    if (r.apollo_person_id) seenApollo.add(r.apollo_person_id);
    const e = normEmail(r.email);
    if (e) seenEmail.add(e);
    const ts = companyTitleKey(r.company_name, r.job_title);
    if (ts) seenTitleSig.add(ts);
    const cs = companyContactKey(r.company_name, r.contact_name);
    if (cs) seenContactSig.add(cs);
    const m = mobileKey(r.phone);
    if (m) seenMobile.add(m);
  }

  const { data: nichesData } = await admin.from("niches").select("*");
  const niches = (nichesData as Niche[] | null) ?? [];

  const toInsert: Record<string, unknown>[] = [];
  let skippedDup = 0;
  let skippedNoPhone = 0;
  for (const row of capped) {
    const company = cleanField(row.company_name, 200);
    const contact = cleanField(row.contact_name, 200);
    if (!company && !contact) {
      skippedDup++;
      continue; // an empty row
    }
    const email = normEmail(row.email);
    const apolloId = cleanField(row.apollo_person_id, 100);
    const jobTitle = cleanField(row.job_title, 200);
    const phone = norwegianPhone(row.phone);
    const titleSig = companyTitleKey(company, jobTitle);
    const contactSig = companyContactKey(company, contact);
    const mobile = mobileKey(phone);

    const isDup =
      (apolloId && seenApollo.has(apolloId)) ||
      (email && seenEmail.has(email)) ||
      (contactSig && seenContactSig.has(contactSig)) ||
      (titleSig && seenTitleSig.has(titleSig)) ||
      (mobile && seenMobile.has(mobile));
    if (isDup) {
      skippedDup++;
      continue;
    }
    // Skip leads without a (Norwegian) phone number when required.
    if (requirePhone && !phone) {
      skippedNoPhone++;
      continue;
    }
    // Reserve within this batch too, so a file with internal duplicates dedups.
    if (apolloId) seenApollo.add(apolloId);
    if (email) seenEmail.add(email);
    if (contactSig) seenContactSig.add(contactSig);
    if (titleSig) seenTitleSig.add(titleSig);
    if (mobile) seenMobile.add(mobile);

    const website = cleanField(row.website, 300);
    const industry = cleanField(row.industry, 120);
    const niche = matchNiche(niches, { company, industry, website, title: jobTitle });

    toInsert.push({
      company_name: company,
      contact_name: contact,
      email,
      phone,
      website,
      industry,
      job_title: jobTitle,
      apollo_person_id: apolloId,
      niche_id: niche?.id ?? null,
      source: "apollo",
      status: "new",
      enriched_at: new Date().toISOString(),
    });
  }

  const skipped = skippedDup + skippedNoPhone;
  const insertedIds: string[] = [];
  for (let i = 0; i < toInsert.length; i += 500) {
    const chunk = toInsert.slice(i, i + 500);
    const { data, error } = await admin.from("leads").insert(chunk).select("id");
    if (error) {
      return { ok: false, imported: insertedIds.length, skipped, insertedIds, message: safeError("importApolloLeads", error) };
    }
    insertedIds.push(...(data ?? []).map((r) => r.id as string));
  }
  const imported = insertedIds.length;

  await logAudit(actor, "leads.import_csv", { details: { imported, skippedDup, skippedNoPhone } });
  revalidatePath("/admin/leads");
  revalidatePath("/dashboard");

  const truncated =
    rows.length > IMPORT_MAX ? ` (kun de første ${IMPORT_MAX} av ${rows.length} rader ble behandlet)` : "";
  const skipParts = [
    skippedDup ? `${skippedDup} duplikater/tomme` : "",
    skippedNoPhone ? `${skippedNoPhone} uten telefon` : "",
  ].filter(Boolean);
  const skipNote = skipParts.length ? `, hoppet over ${skipParts.join(" + ")}` : "";
  const message = imported
    ? `Importerte ${imported} nye leads${skipNote}${truncated}. Alle er markert – trykk «Fordel jevnt».`
    : `Ingen nye leads${skipNote || ` – ${skipped} filtrert bort`}${truncated}.`;
  return { ok: true, imported, skipped, insertedIds, message };
}
