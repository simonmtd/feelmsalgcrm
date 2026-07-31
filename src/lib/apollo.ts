import "server-only";
import { DEMO_MOCK } from "@/lib/demo/mode";

const APOLLO_BASE = "https://api.apollo.io/api/v1";

export interface ApolloEnrichInput {
  /** Apollo person id — when set, we match by id (exact), ignoring name/company.
   *  Used for leads sourced from Apollo search, whose name is masked on import. */
  apolloId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  organizationName?: string | null;
  domain?: string | null;
  email?: string | null;
}

export interface ApolloEnrichResult {
  /** Apollo's stable person id, stored so the phone webhook can find the lead. */
  apolloPersonId: string | null;
  /** Full person name (revealed) — Apollo-imported leads have no name until now. */
  name: string | null;
  email: string | null;
  /** Synchronously returned phone, if any. Mobile numbers usually arrive later
   *  via the webhook instead, in which case this is null and phonePending true. */
  phone: string | null;
  /** True when we asked Apollo to reveal a phone number that will arrive async. */
  phonePending: boolean;
  website: string | null;
  industry: string | null;
  jobTitle: string | null;
  organizationName: string | null;
}

interface ApolloPhoneNumber {
  raw_number?: string;
  sanitized_number?: string;
  type?: string;
}

interface ApolloPerson {
  id?: string;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  title?: string | null;
  phone_numbers?: ApolloPhoneNumber[];
  personal_emails?: string[];
  organization?: {
    name?: string | null;
    website_url?: string | null;
    primary_domain?: string | null;
    industry?: string | null;
  } | null;
}

function requireKey(): string {
  const key = process.env.APOLLO_API_KEY;
  if (!key) throw new Error("APOLLO_API_KEY er ikke satt.");
  return key;
}

export function apolloConfigured(): boolean {
  return DEMO_MOCK || Boolean(process.env.APOLLO_API_KEY);
}

/**
 * Builds the public URL Apollo POSTs the revealed phone number back to. Prefers
 * an explicit APP_URL, falls back to the Vercel production URL. Returns null if
 * neither is available (e.g. local dev), in which case we skip phone reveal.
 */
export function phoneWebhookUrl(): string | null {
  const base =
    process.env.APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null);
  const secret = process.env.APOLLO_WEBHOOK_SECRET ?? process.env.CRON_SECRET;
  if (!base || !secret) return null;
  return `${base.replace(/\/$/, "")}/api/apollo/phone-webhook?secret=${encodeURIComponent(secret)}`;
}

function firstPhone(person: ApolloPerson): string | null {
  const n = person.phone_numbers?.[0];
  return n?.sanitized_number ?? n?.raw_number ?? null;
}

/**
 * Looks up a person in Apollo by name + company (or email/domain) and returns
 * their revealed contact info. Consumes an Apollo credit when a phone/email is
 * revealed, so callers should only run this on demand for leads a seller is
 * actually working. Requires APOLLO_API_KEY (a paid Apollo plan with API
 * access). Returns fake data in demo mode.
 *
 * Mobile numbers are delivered asynchronously to `webhookUrl`; when we request
 * one, the immediate result has phone=null and phonePending=true, and the
 * webhook fills in the number later (matched on apolloPersonId).
 */
export async function enrichPerson(
  input: ApolloEnrichInput
): Promise<ApolloEnrichResult> {
  if (DEMO_MOCK) {
    const { enrichDemoPerson } = await import("@/lib/demo/apollo");
    return enrichDemoPerson(input);
  }

  const key = requireKey();
  const webhookUrl = phoneWebhookUrl();

  const body: Record<string, unknown> = {
    reveal_personal_emails: true,
  };
  // An exact Apollo id is the most reliable match; fall back to name+company.
  if (input.apolloId) body.id = input.apolloId;
  if (input.firstName) body.first_name = input.firstName;
  if (input.lastName) body.last_name = input.lastName;
  if (input.organizationName) body.organization_name = input.organizationName;
  if (input.domain) body.domain = input.domain;
  if (input.email) body.email = input.email;
  // Only ask for a phone reveal if we have somewhere for Apollo to send it.
  if (webhookUrl) {
    body.reveal_phone_number = true;
    body.webhook_url = webhookUrl;
  }

  const res = await fetch(`${APOLLO_BASE}/people/match`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": key,
    },
    cache: "no-store",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Apollo API-feil (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as { person?: ApolloPerson | null };
  const person = data.person ?? null;
  if (!person) {
    return {
      apolloPersonId: null,
      name: null,
      email: null,
      phone: null,
      phonePending: false,
      website: null,
      industry: null,
      jobTitle: null,
      organizationName: null,
    };
  }

  const phone = firstPhone(person);
  const fullName =
    person.name ??
    ([person.first_name, person.last_name].filter(Boolean).join(" ") || null);
  return {
    apolloPersonId: person.id ?? null,
    name: fullName || null,
    email: person.email ?? person.personal_emails?.[0] ?? null,
    phone,
    // We asked for a reveal (webhookUrl set) but got nothing back synchronously:
    // the number is coming via the webhook.
    phonePending: Boolean(webhookUrl) && !phone,
    website: person.organization?.website_url ?? person.organization?.primary_domain ?? null,
    industry: person.organization?.industry ?? null,
    jobTitle: person.title ?? null,
    organizationName: person.organization?.name ?? null,
  };
}

export interface ApolloProspect {
  apolloId: string;
  companyName: string | null;
  jobTitle: string | null;
  /** Whether Apollo holds an email / direct phone we could reveal on enrichment. */
  hasEmail: boolean;
  hasPhone: boolean;
}

interface ApolloSearchPerson {
  id?: string;
  title?: string | null;
  has_email?: boolean;
  has_direct_phone?: boolean;
  organization?: { name?: string | null } | null;
}

/**
 * Searches Apollo's people database (prospecting) for one page of candidates
 * matching the given titles + locations. The search response is heavily masked
 * — you get a stable id, title, company name and has_email/has_direct_phone
 * flags, but the real name/email/phone are only revealed later via enrichPerson
 * (which costs credits). Returns fake prospects in demo mode.
 */
export async function searchApolloPeople(input: {
  titles: string[];
  locations: string[];
  page: number;
  perPage?: number;
  /** Free-text industry/company keyword (Apollo q_keywords) to narrow the
   *  search, e.g. "eiendom". Norwegian terms work well. */
  keywords?: string;
  /** Apollo organization_num_employees_ranges, e.g. ["11,50"]. */
  employeeRanges?: string[];
}): Promise<{ people: ApolloProspect[] }> {
  if (DEMO_MOCK) {
    const { searchDemoApolloPeople } = await import("@/lib/demo/apollo");
    return searchDemoApolloPeople(input);
  }

  const key = requireKey();
  const body: Record<string, unknown> = {
    person_titles: input.titles,
    // person_locations filters on the PERSON's location; organization_locations
    // on the COMPANY's HQ. Both must be Norway so we don't pull foreign
    // companies that merely happen to have a Norway-based employee.
    person_locations: input.locations,
    organization_locations: input.locations,
    page: input.page,
    per_page: input.perPage ?? 25,
  };
  if (input.keywords?.trim()) body.q_keywords = input.keywords.trim();
  if (input.employeeRanges?.length) body.organization_num_employees_ranges = input.employeeRanges;

  const res = await fetch(`${APOLLO_BASE}/mixed_people/api_search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": key,
    },
    cache: "no-store",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Apollo search-feil (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as { people?: ApolloSearchPerson[] };
  const people: ApolloProspect[] = (data.people ?? [])
    .filter((p) => p.id)
    .map((p) => ({
      apolloId: p.id as string,
      companyName: p.organization?.name ?? null,
      jobTitle: p.title ?? null,
      hasEmail: Boolean(p.has_email),
      hasPhone: Boolean(p.has_direct_phone),
    }));
  return { people };
}

/** Splits a full name into first/last for Apollo's match params. */
export function splitName(name: string | null): { first: string | null; last: string | null } {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: null, last: null };
  if (parts.length === 1) return { first: parts[0], last: null };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

/** Strips a URL down to a bare domain (example.no) for Apollo's `domain` param. */
export function toDomain(website: string | null): string | null {
  if (!website) return null;
  return (
    website
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split(/[/?#]/)[0]
      .trim() || null
  );
}

/** The lead columns enrichment reads (to decide what's missing) and can fill. */
export interface LeadEnrichSnapshot {
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  industry: string | null;
  job_title: string | null;
}

/**
 * Builds a fill-if-missing update from an Apollo result: only sets columns the
 * lead doesn't already have, so a seller's manual entry is never overwritten.
 * Returns the update object plus human labels for what got filled.
 */
export function enrichmentUpdate(
  lead: LeadEnrichSnapshot,
  result: ApolloEnrichResult
): { update: Record<string, string | null>; filled: string[] } {
  const update: Record<string, string | null> = {};
  const filled: string[] = [];
  const maybe = (col: keyof LeadEnrichSnapshot, value: string | null, label: string) => {
    if (!lead[col] && value) {
      update[col] = value;
      filled.push(label);
    }
  };
  maybe("contact_name", result.name, "navn");
  maybe("email", result.email, "e-post");
  maybe("phone", result.phone, "telefon");
  maybe("website", result.website, "nettside");
  maybe("industry", result.industry, "bransje");
  maybe("job_title", result.jobTitle, "tittel");
  maybe("company_name", result.organizationName, "firma");
  return { update, filled };
}

/**
 * Parses an Apollo phone-reveal webhook payload into (apolloPersonId, phone)
 * pairs. Apollo's exact shape has varied, so we look for people/contacts arrays
 * or a single person, and pull the first phone number off each.
 */
export function parsePhoneWebhook(
  payload: unknown
): { apolloPersonId: string; phone: string }[] {
  const out: { apolloPersonId: string; phone: string }[] = [];
  const consider = (p: ApolloPerson | undefined | null) => {
    if (!p?.id) return;
    const phone = firstPhone(p);
    if (phone) out.push({ apolloPersonId: p.id, phone });
  };

  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    const people = (obj.people ?? obj.contacts) as ApolloPerson[] | undefined;
    if (Array.isArray(people)) people.forEach(consider);
    if (obj.person) consider(obj.person as ApolloPerson);
    if (obj.id) consider(obj as ApolloPerson);
  }
  return out;
}
