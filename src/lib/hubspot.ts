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
    [key: string]: string | undefined;
  };
}

interface HubspotContactsResponse {
  results: HubspotContact[];
  paging?: { next?: { after?: string } };
}

/**
 * Fetches one page of HubSpot contacts. Requires a private app access token
 * with crm.objects.contacts.read scope, set as HUBSPOT_ACCESS_TOKEN.
 */
export async function fetchHubspotContacts(
  after?: string
): Promise<{ results: HubspotContact[]; nextAfter?: string }> {
  if (DEMO_MOCK) {
    const { fetchDemoHubspotContacts } = await import("@/lib/demo/hubspot");
    return fetchDemoHubspotContacts(after);
  }

  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    throw new Error("HUBSPOT_ACCESS_TOKEN er ikke satt.");
  }

  const params = new URLSearchParams({
    limit: "100",
    properties: "firstname,lastname,email,phone,company,website",
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
