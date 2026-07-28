import "server-only";
import type { HubspotContact } from "@/lib/hubspot";

const DEMO_CONTACTS: HubspotContact[] = [
  {
    id: "demo-hs-1",
    properties: {
      firstname: "Sindre",
      lastname: "Vold",
      email: "sindre@voldbygg.no",
      phone: "92345678",
      company: "Vold Byggservice",
      website: "voldbygg.no",
      industry: "Bygg og anlegg",
      jobtitle: "Daglig leder",
    },
  },
  {
    id: "demo-hs-2",
    properties: {
      firstname: "Marte",
      lastname: "Iversen",
      email: "marte@kystrestaurant.no",
      phone: "97612345",
      company: "Kystrestauranten",
      website: "kystrestauranten.no",
      industry: "Restaurant og servering",
      jobtitle: "Innehaver",
    },
  },
];

/**
 * Simulates one page of the HubSpot contacts API for demo mode: returns the
 * same small fake contact list on the first call and an empty page after,
 * so `runHubspotSync`'s pagination loop terminates after a single page.
 */
export async function fetchDemoHubspotContacts(
  after?: string
): Promise<{ results: HubspotContact[]; nextAfter?: string }> {
  if (after) return { results: [] };
  return { results: DEMO_CONTACTS };
}
