import { DEMO_MOCK } from "@/lib/demo/mode";

const HUBSPOT_BASE = "https://api.hubapi.com";

export interface HubspotContact {
  id: string;
  properties: {
    firstname?: string;
    lastname?: string;
    email?: string;
    phone?: string;
    company?: string;
    website?: string;
    industry?: string;
    jobtitle?: string;
    [key: string]: string | undefined;
  };
  /** IDs of associated company objects, when requested. */
  associations?: {
    companies?: { results?: { id: string }[] };
  };
}

export interface HubspotCompany {
  name: string | null;
  industry: string | null;
  domain: string | null;
}

interface HubspotContactsResponse {
  results: HubspotContact[];
  paging?: { next?: { after?: string } };
}

function requireToken(): string {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) throw new Error("HUBSPOT_ACCESS_TOKEN er ikke satt.");
  return token;
}

/**
 * Fetches one page of HubSpot contacts, including the IDs of any associated
 * company objects. Requires a private app access token with
 * crm.objects.contacts.read scope (and crm.objects.companies.read to resolve
 * the associated company data via fetchHubspotCompanies).
 */
export async function fetchHubspotContacts(
  after?: string
): Promise<{ results: HubspotContact[]; nextAfter?: string }> {
  if (DEMO_MOCK) {
    const { fetchDemoHubspotContacts } = await import("@/lib/demo/hubspot");
    return fetchDemoHubspotContacts(after);
  }

  const token = requireToken();

  const params = new URLSearchParams({
    limit: "100",
    properties: "firstname,lastname,email,phone,company,website,industry,jobtitle",
    associations: "companies",
  });
  if (after) params.set("after", after);

  const res = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/contacts?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`HubSpot API-feil (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as HubspotContactsResponse;
  return {
    results: data.results ?? [],
    nextAfter: data.paging?.next?.after,
  };
}

/**
 * Batch-reads company objects by ID and returns a map of id -> company data
 * (name, industry, domain). Chunks into 100-per-request as HubSpot requires.
 * Returns an empty map in demo mode.
 */
export async function fetchHubspotCompanies(
  ids: string[]
): Promise<Map<string, HubspotCompany>> {
  const map = new Map<string, HubspotCompany>();
  if (DEMO_MOCK || ids.length === 0) return map;

  const token = requireToken();
  const unique = [...new Set(ids)];

  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const res = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/companies/batch/read`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        properties: ["name", "industry", "domain"],
        inputs: chunk.map((id) => ({ id })),
      }),
    });

    if (!res.ok) {
      throw new Error(`HubSpot companies-feil (${res.status}): ${await res.text()}`);
    }

    const data = (await res.json()) as {
      results?: { id: string; properties: { name?: string; industry?: string; domain?: string } }[];
    };
    for (const c of data.results ?? []) {
      map.set(c.id, {
        name: c.properties.name ?? null,
        industry: c.properties.industry ?? null,
        domain: c.properties.domain ?? null,
      });
    }
  }

  return map;
}

/**
 * HubSpot stores industry as an English enum code (REAL_ESTATE,
 * INFORMATION_TECHNOLOGY_AND_SERVICES). Turn it into a readable label. A few
 * common ones get a Norwegian label; the rest are title-cased from the code.
 */
const INDUSTRY_LABELS: Record<string, string> = {
  CONSTRUCTION: "Bygg og anlegg",
  REAL_ESTATE: "Eiendom",
  COMMERCIAL_REAL_ESTATE: "Eiendom",
  RESTAURANTS: "Restaurant",
  FOOD_BEVERAGES: "Mat og drikke",
  HOSPITALITY: "Servering og overnatting",
  AUTOMOTIVE: "Bil",
  HEALTH_WELLNESS_AND_FITNESS: "Helse og velvære",
  RETAIL: "Varehandel",
  SPORTING_GOODS: "Sport og fritid",
  MARKETING_AND_ADVERTISING: "Markedsføring og reklame",
  INFORMATION_TECHNOLOGY_AND_SERVICES: "IT og teknologi",
  COMPUTER_SOFTWARE: "IT og teknologi",
  MOTION_PICTURES_AND_FILM: "Film og produksjon",
  MANAGEMENT_CONSULTING: "Konsulent",
  DESIGN: "Design",
  BANKING: "Bank og finans",
  FINANCIAL_SERVICES: "Bank og finans",
  CONSUMER_ELECTRONICS: "Elektronikk",
  FACILITIES_SERVICES: "Drift og vedlikehold",
  APPAREL_FASHION: "Klær og mote",
};

export function readableIndustry(code: string | null | undefined): string | null {
  if (!code) return null;
  if (INDUSTRY_LABELS[code]) return INDUSTRY_LABELS[code];
  return code
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
