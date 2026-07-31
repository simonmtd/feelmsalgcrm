import type {
  ApolloEnrichInput,
  ApolloEnrichResult,
  ApolloProspect,
} from "@/lib/apollo";

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
    name:
      [input.firstName, input.lastName].filter(Boolean).join(" ") || "Demo Kontakt",
    email: input.email ?? `${first || "kontakt"}@${slug}.no`,
    phone: `+47 ${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`,
    phonePending: false,
    website: `https://${slug}.no`,
    industry: null,
    jobTitle: "Daglig leder",
    organizationName: input.organizationName ?? null,
  };
}

/** Fake Apollo prospecting search for demo mode. */
export function searchDemoApolloPeople(input: {
  titles: string[];
  locations: string[];
  page: number;
  perPage?: number;
}): { people: ApolloProspect[] } {
  const firms = [
    "Fjordvik Eiendom AS",
    "Nordlys Bygg AS",
    "Kystmat Handel AS",
    "Bytårn Restaurant AS",
    "Solberg Auto AS",
  ];
  const titles = input.titles.length ? input.titles : ["Daglig leder"];
  const per = input.perPage ?? 25;
  const start = (input.page - 1) * per;
  const people: ApolloProspect[] = Array.from({ length: Math.min(per, 5) }).map((_, i) => {
    const n = start + i;
    return {
      apolloId: `demo-prospect-${n}`,
      companyName: firms[n % firms.length],
      jobTitle: titles[n % titles.length],
      hasEmail: true,
      hasPhone: n % 2 === 0,
    };
  });
  // Only two pages of fake prospects, then "empty" to end the loop.
  return { people: input.page > 2 ? [] : people };
}
