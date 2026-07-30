import type { ApolloEnrichInput, ApolloEnrichResult } from "@/lib/apollo";

/**
 * Fake Apollo enrichment for demo mode: fabricates a plausible phone/email from
 * the input so the "Berik"-button can be exercised without a real Apollo key.
 */
export function enrichDemoPerson(input: ApolloEnrichInput): ApolloEnrichResult {
  const slug = (input.organizationName ?? "firma")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 12) || "firma";
  const first = (input.firstName ?? "kontakt").toLowerCase().replace(/[^a-z]/g, "");
  const digits = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join("");
  return {
    apolloPersonId: `demo-${slug}`,
    email: input.email ?? `${first || "kontakt"}@${slug}.no`,
    phone: `+47 ${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`,
    phonePending: false,
    website: `https://${slug}.no`,
    industry: null,
    jobTitle: "Daglig leder",
    organizationName: input.organizationName ?? null,
  };
}
