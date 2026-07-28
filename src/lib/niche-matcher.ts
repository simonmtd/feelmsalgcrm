import "server-only";
import type { Niche } from "@/lib/types";

// Short slug tokens carry no signal ("as", "og"); ignore them when matching.
const MIN_TOKEN_LENGTH = 3;

function tokensFor(niche: Niche): string[] {
  return niche.slug
    .split("-")
    .map((t) => t.trim())
    .filter((t) => t.length >= MIN_TOKEN_LENGTH);
}

/**
 * Picks the best-matching niche for a HubSpot contact by looking for a niche's
 * slug tokens inside the contact's text (company name, industry, website,
 * title). Norwegian company names usually contain the trade word, e.g.
 * "Nordvik Bygg AS" → "Bygg & Anlegg". Returns null when nothing matches, so
 * the lead stays unclassified for manual review instead of being mis-filed.
 */
export function matchNiche(
  niches: Niche[],
  fields: { company?: string | null; industry?: string | null; website?: string | null; title?: string | null }
): Niche | null {
  const haystack = [fields.company, fields.industry, fields.website, fields.title]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!haystack) return null;

  for (const niche of niches) {
    if (tokensFor(niche).some((token) => haystack.includes(token))) {
      return niche;
    }
  }
  return null;
}
