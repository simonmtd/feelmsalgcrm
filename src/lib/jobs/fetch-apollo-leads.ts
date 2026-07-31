import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { searchApolloPeople } from "@/lib/apollo";
import { verifyNorwegianCompany, type BrregMatch } from "@/lib/brreg";
import { matchNiche } from "@/lib/niche-matcher";
import type { Niche } from "@/lib/types";

export interface ApolloFetchResult {
  ok: boolean;
  imported: number;
  autoClassified: number;
  scanned: number;
  /** Candidates dropped because they aren't verified Norwegian companies. */
  rejectedForeign: number;
  error?: string;
}

/** Stop scanning after this many candidates so a low match-rate run can't run
 *  past the serverless time budget (each candidate does a brreg lookup). */
const MAX_SCAN = 250;

/** Feelm's ideal-customer titles (decision-makers who buy video), Norway-wide. */
const ICP_TITLES = [
  // Toppledere
  "Daglig leder",
  "CEO",
  "Managing Director",
  "General Manager",
  "Founder",
  "Co-Founder",
  "Administrerende direktør",
  // Marked
  "Markedssjef",
  "CMO",
  "Marketing Manager",
  "Marketing Director",
  "Markedsansvarlig",
  "Head of Marketing",
  // Kommunikasjon
  "Kommunikasjonssjef",
  "Head of Communications",
  "Communications Manager",
];
const ICP_LOCATIONS = ["Norway"];

/** Safety cap so a bad search can't page forever. */
const MAX_PAGES = 20;
const PER_PAGE = 25;

/**
 * Pulls fresh prospects from Apollo matching Feelm's ICP and imports the new
 * ones (deduped on apollo_person_id) into the lead pool as unassigned `new`
 * leads. Only imports candidates Apollo actually has an email or phone for, so
 * the pool stays reachable. Contact details are masked at this stage — a later
 * enrichment (the "Berik" button/batch, matched on apollo_person_id) reveals
 * name/phone/email. Auto-classifies niche from company + title so the daily
 * assignment job can distribute them.
 */
export async function runApolloLeadFetch(
  limit = 25,
  opts: { keywords?: string; nicheId?: string | null } = {}
): Promise<ApolloFetchResult> {
  if (!process.env.APOLLO_API_KEY && process.env.DEMO_MOCK !== "1") {
    return { ok: false, imported: 0, autoClassified: 0, scanned: 0, rejectedForeign: 0, error: "APOLLO_API_KEY mangler." };
  }

  const supabase = createAdminClient();
  const target = Math.max(1, Math.min(200, Math.floor(limit) || 0));

  const { data: nichesData } = await supabase.from("niches").select("*");
  const niches = (nichesData as Niche[] | null) ?? [];

  // Existing Apollo ids, so we never import the same person twice.
  const { data: existingData } = await supabase
    .from("leads")
    .select("apollo_person_id")
    .not("apollo_person_id", "is", null);
  const seen = new Set(
    ((existingData as { apollo_person_id: string }[] | null) ?? []).map((r) => r.apollo_person_id)
  );

  let imported = 0;
  let autoClassified = 0;
  let scanned = 0;
  let rejectedForeign = 0;
  // Cache brreg lookups within a run (many rows can share a company name).
  const brregCache = new Map<string, BrregMatch | null>();

  try {
    for (let page = 1; page <= MAX_PAGES && imported < target && scanned < MAX_SCAN; page++) {
      const { people } = await searchApolloPeople({
        titles: ICP_TITLES,
        locations: ICP_LOCATIONS,
        page,
        perPage: PER_PAGE,
        keywords: opts.keywords,
      });
      if (people.length === 0) break; // no more results

      const rows = [];
      for (const p of people) {
        if (imported + rows.length >= target || scanned >= MAX_SCAN) break;
        if (seen.has(p.apolloId)) continue;
        if (!p.hasEmail && !p.hasPhone) continue; // skip unreachable prospects
        seen.add(p.apolloId);
        scanned++;

        // Verify against Brønnøysund: only genuine Norwegian companies pass.
        const key = (p.companyName ?? "").toLowerCase().trim();
        let brreg = brregCache.get(key);
        if (brreg === undefined) {
          brreg = await verifyNorwegianCompany(p.companyName);
          brregCache.set(key, brreg);
        }
        if (!brreg) {
          rejectedForeign++;
          continue; // not a verified Norwegian company
        }

        // When the admin picked a specific bransje we searched for it directly,
        // so tag every import with that niche. Otherwise best-effort match.
        const nicheId =
          opts.nicheId ??
          matchNiche(niches, {
            company: p.companyName,
            industry: null,
            website: null,
            title: p.jobTitle,
          })?.id ??
          null;
        if (nicheId) autoClassified++;

        rows.push({
          apollo_person_id: p.apolloId,
          company_name: p.companyName,
          org_number: brreg.orgNumber,
          job_title: p.jobTitle,
          niche_id: nicheId,
          source: "apollo",
          status: "new",
        });
      }

      if (rows.length > 0) {
        const { data: inserted, error } = await supabase
          .from("leads")
          .insert(rows)
          .select("id");
        if (error) throw new Error(error.message);
        imported += (inserted ?? []).length;
      }
    }

    return { ok: true, imported, autoClassified, scanned, rejectedForeign };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, imported, autoClassified, scanned, rejectedForeign, error: message };
  }
}
