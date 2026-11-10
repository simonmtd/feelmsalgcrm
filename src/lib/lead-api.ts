import "server-only";
import { fetchAll } from "@/lib/fetch-all";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { ApiCaller } from "@/lib/api-keys";
import { loadApiSellers, normalizeHandle } from "@/lib/api-keys";
import { loadLeadDedupIndex, loadCalledCompanies, type DedupKey } from "@/lib/lead-dedup-index";
import { normEmail, normCompany } from "@/lib/dedup";
import { norwegianPhone } from "@/lib/apollo";
import { matchNiche } from "@/lib/niche-matcher";
import { notify } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";
import type { Niche } from "@/lib/types";

type Admin = ReturnType<typeof createAdminClient>;

/** Max leads accepted in one POST. */
export const API_BATCH_MAX = 200;

/** Sources a bot may tag its leads with (must also be allowed by leads_source_check). */
const API_SOURCES = ["apollo-grok"] as const;

/** Optional text field: numbers are accepted as text, blanks become null. */
const str = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "number" ? String(v) : v),
    z
      .string()
      .trim()
      .max(max)
      .nullish()
      .transform((v) => v || null)
  );

export const apiLeadSchema = z.object({
  first_name: str(100),
  last_name: str(100),
  title: str(200),
  company_name: str(200),
  company_domain: str(300),
  email: str(320),
  email_status: str(50),
  phone: str(50),
  linkedin_url: str(500),
  country: str(100),
  city: str(100),
  industry: str(120),
  employee_count: z
    .preprocess(
      (v) => (v == null || v === "" ? null : Number(String(v).replace(/\s/g, ""))),
      z.number().int().min(0).nullable()
    )
    .catch(null),
  orgnr: str(30),
  source: z.enum(API_SOURCES).default("apollo-grok"),
  notes: str(5000),
  assigned_to: str(50),
});

export type ApiLeadInput = z.infer<typeof apiLeadSchema>;

export type RejectReason =
  | "invalid"
  | "missing_name"
  | "invalid_email"
  | "missing_assigned_to"
  | "unknown_seller"
  | "seller_mismatch"
  | "duplicate"
  | "no_norwegian_phone"
  | "company_already_called";

export interface CreatedLead {
  index: number;
  id: string;
  assigned_to: string;
  warnings?: string[];
}

export interface RejectedLead {
  index: number;
  reason: RejectReason;
  message: string;
  duplicate_of?: string | null;
  matched_on?: DedupKey;
}

const REJECT_MESSAGES: Record<RejectReason, string> = {
  invalid: "Ugyldige felter",
  missing_name: "Mangler både company_name og navn på kontaktperson",
  invalid_email: "Ugyldig e-postadresse",
  missing_assigned_to: "assigned_to er påkrevd",
  unknown_seller: "Ukjent selger i assigned_to",
  seller_mismatch: "API-nøkkelen tilhører en annen selger enn assigned_to",
  duplicate: "Finnes allerede i CRM-et",
  no_norwegian_phone: "Mangler norsk telefonnummer",
  company_already_called: "Teamet har allerede ringt dette selskapet",
};

/** "https://www.Feelm.no/om-oss" → "feelm.no". Returns null if not domain-like. */
export function normDomain(raw: string | null | undefined): string | null {
  const d = (raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#:]/)[0];
  return /^[a-z0-9æøå-]+(\.[a-z0-9æøå-]+)*\.[a-z]{2,}$/.test(d) ? d : null;
}

const EMAIL_RE = /^[^\s@,;()<>"]+@[^\s@,;()<>"]+\.[a-z]{2,}$/i;
export function validEmail(e: string | null): boolean {
  return !!e && EMAIL_RE.test(e);
}

/**
 * Ingests leads from a bot. Same checks as the Apollo CSV import (dedup on
 * Apollo id / email / company+contact / company+role / Norwegian mobile, and a
 * Norwegian phone is required), plus the assignment guard that holds back
 * companies the team has already called. Accepted leads go straight to the
 * seller in `assigned_to` (or the seller the API key belongs to).
 */
export async function ingestApiLeads(
  admin: Admin,
  caller: ApiCaller,
  rawLeads: unknown[]
): Promise<{ created: CreatedLead[]; rejected: RejectedLead[] }> {
  const created: CreatedLead[] = [];
  const rejected: RejectedLead[] = [];
  const reject = (index: number, reason: RejectReason, extra: Partial<RejectedLead> = {}) =>
    rejected.push({ index, reason, message: REJECT_MESSAGES[reason], ...extra });

  const [sellers, dedup, calledCompanies, nichesRes] = await Promise.all([
    loadApiSellers(admin),
    loadLeadDedupIndex(admin),
    loadCalledCompanies(admin),
    admin.from("niches").select("*"),
  ]);
  const niches = (nichesRes.data as Niche[] | null) ?? [];
  const sellerById = new Map([...sellers.values()].map((s) => [s.id, s]));
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  const pending: { index: number; row: Record<string, unknown>; sellerId: string; handle: string; notes: string | null; warnings: string[] }[] = [];

  rawLeads.forEach((raw, index) => {
    const parsed = apiLeadSchema.safeParse(raw);
    if (!parsed.success) {
      reject(index, "invalid", {
        message: parsed.error.issues.map((i) => `${i.path.join(".") || "lead"}: ${i.message}`).join("; "),
      });
      return;
    }
    const l = parsed.data;
    const warnings: string[] = [];

    // Who gets it: a seller key decides on its own; an admin key needs assigned_to.
    let sellerId: string;
    let handle: string;
    const requested = normalizeHandle(l.assigned_to);
    if (caller.kind === "seller") {
      const own = sellerById.get(caller.sellerId);
      if (!own) return reject(index, "unknown_seller", { message: "Selgeren denne API-nøkkelen tilhører er ikke aktiv" });
      if (requested && requested !== own.handle) return reject(index, "seller_mismatch");
      sellerId = own.id;
      handle = own.handle;
    } else {
      if (!requested) return reject(index, "missing_assigned_to");
      const s = sellers.get(requested);
      if (!s) {
        return reject(index, "unknown_seller", {
          message: `Ukjent selger «${l.assigned_to}». Gyldige: ${[...sellers.keys()].sort().join(", ")}`,
        });
      }
      sellerId = s.id;
      handle = s.handle;
    }

    const contact = [l.first_name, l.last_name].filter(Boolean).join(" ") || null;
    const company = l.company_name;
    if (!company && !contact) return reject(index, "missing_name");

    const email = normEmail(l.email);
    if (email && !validEmail(email)) return reject(index, "invalid_email");

    const phone = norwegianPhone(l.phone);
    const dedupFields = { email, company, contact, title: l.title, phone };
    const hit = dedup.find(dedupFields);
    if (hit) return reject(index, "duplicate", { duplicate_of: hit.leadId, matched_on: hit.matchedOn });

    if (!phone) {
      return reject(index, "no_norwegian_phone", {
        message: l.phone ? `Telefonnummeret «${l.phone}» er ikke norsk` : REJECT_MESSAGES.no_norwegian_phone,
      });
    }

    const companyKey = normCompany(company);
    if (companyKey && calledCompanies.has(companyKey)) return reject(index, "company_already_called");

    // Reserve within this batch so duplicates inside one request are caught too.
    const id = randomUUID();
    dedup.add(dedupFields, id);

    const website = l.company_domain ? normDomain(l.company_domain) : null;
    if (l.company_domain && !website) warnings.push(`company_domain «${l.company_domain}» ble ignorert (ugyldig domene)`);

    let orgNumber: string | null = null;
    if (l.orgnr) {
      const digits = l.orgnr.replace(/\D/g, "");
      if (digits.length === 9) orgNumber = digits;
      else warnings.push(`orgnr «${l.orgnr}» ble ignorert (må være 9 siffer)`);
    }

    const niche = matchNiche(niches, { company, industry: l.industry, website, title: l.title });

    pending.push({
      index,
      sellerId,
      handle,
      notes: l.notes,
      warnings,
      row: {
        id,
        company_name: company,
        contact_name: contact,
        email,
        email_status: l.email_status,
        phone,
        website,
        industry: l.industry,
        job_title: l.title,
        linkedin_url: l.linkedin_url,
        city: l.city,
        country: l.country,
        employee_count: l.employee_count ?? null,
        org_number: orgNumber,
        niche_id: niche?.id ?? null,
        source: l.source,
        status: "assigned",
        assigned_to: sellerId,
        assigned_date: today,
        enriched_at: now,
      },
    });
  });

  if (pending.length) {
    // Ids are generated here so notes/notifications map to the right lead
    // without relying on the order of the returned rows.
    const { error } = await admin.from("leads").insert(pending.map((p) => p.row));
    if (error) throw error;
    const ids = pending.map((p) => p.row.id as string);

    const activities: Record<string, unknown>[] = [];
    pending.forEach((p, i) => {
      const id = ids[i];
      created.push({ index: p.index, id, assigned_to: p.handle, ...(p.warnings.length ? { warnings: p.warnings } : {}) });
      if (p.notes) activities.push({ lead_id: id, seller_id: p.sellerId, type: "note", content: p.notes });
    });
    if (activities.length) {
      const { error: actError } = await admin.from("lead_activities").insert(activities);
      if (actError) console.error("[lead-api] notes insert failed", actError);
    }

    // One notification per seller, like the bulk-assign flow.
    const perSeller = new Map<string, string[]>();
    pending.forEach((p, i) => perSeller.set(p.sellerId, [...(perSeller.get(p.sellerId) ?? []), ids[i]]));
    for (const [sellerId, leadIds] of perSeller) {
      const n = leadIds.length;
      await notify(sellerId, `Du har fått ${n} ${n === 1 ? "ny lead" : "nye leads"} tildelt fra Grok.`, {
        leadId: n === 1 ? leadIds[0] : null,
      });
    }
  }

  const actor =
    caller.kind === "seller"
      ? { id: caller.sellerId, email: sellerById.get(caller.sellerId)?.email ?? `api:${caller.name}` }
      : { id: null, email: `api:${caller.name}` };
  await logAudit(actor, "leads.api_create", {
    details: {
      key: caller.name,
      created: created.length,
      rejected: rejected.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.reason]: (acc[r.reason] ?? 0) + 1 }), {}),
    },
  });

  created.sort((a, b) => a.index - b.index);
  rejected.sort((a, b) => a.index - b.index);
  return { created, rejected };
}

export interface LeadLookupMatch {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  status: string;
  source: string;
  assigned_to: string | null;
  created_at: string;
}

/** Existing leads matching an email (exact) or a domain (email domain or website). */
export async function lookupLeads(
  admin: Admin,
  q: { email: string } | { domain: string }
): Promise<LeadLookupMatch[]> {
  // Filtered in JS (same full-table read the dedup does) so stored values in
  // any shape — mixed-case emails, "https://www.x.no/" websites — match.
  const data = await fetchAll((from, to) =>
    admin
      .from("leads")
      .select("id, company_name, contact_name, email, website, status, source, assigned_to, created_at")
      .order("id")
      .range(from, to)
  );
  type Row = Omit<LeadLookupMatch, "assigned_to"> & { email: string | null; website: string | null; assigned_to: string | null };

  const matches = ((data as Row[] | null) ?? []).filter((r) => {
    const email = normEmail(r.email);
    if ("email" in q) return email === q.email;
    const emailDomain = email?.split("@")[1] ?? null;
    const site = normDomain(r.website);
    const sameOrSub = (d: string | null) => !!d && (d === q.domain || d.endsWith(`.${q.domain}`));
    return sameOrSub(emailDomain) || sameOrSub(site);
  });
  matches.sort((x, y) => y.created_at.localeCompare(x.created_at));

  const sellers = await loadApiSellers(admin);
  const handleById = new Map([...sellers.values()].map((s) => [s.id, s.handle]));
  return matches.slice(0, 50).map((r) => ({
    id: r.id,
    company_name: r.company_name,
    contact_name: r.contact_name,
    status: r.status,
    source: r.source,
    assigned_to: r.assigned_to ? handleById.get(r.assigned_to) ?? "annen selger" : null,
    created_at: r.created_at,
  }));
}
