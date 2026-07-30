import "server-only";
import { DEMO_MOCK } from "@/lib/demo/mode";

const APOLLO_BASE = "https://api.apollo.io/api/v1";

export interface ApolloEnrichInput {
  firstName?: string | null;
  lastName?: string | null;
  organizationName?: string | null;
  domain?: string | null;
  email?: string | null;
}

export interface ApolloEnrichResult {
  /** Apollo's stable person id, stored so the phone webhook can find the lead. */
  apolloPersonId: string | null;
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
  return {
    apolloPersonId: person.id ?? null,
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
