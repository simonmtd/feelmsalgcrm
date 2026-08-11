import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { searchApolloPeople } from "@/lib/apollo";
import { verifyNorwegianCompany, type BrregMatch } from "@/lib/brreg";
import { companyTitleKey, normCompany } from "@/lib/dedup";
import { matchNiche } from "@/lib/niche-matcher";
import type { Niche } from "@/lib/types";

export interface ApolloFetchResult {
  ok: boolean;
  imported: number;
  autoClassified: number;
  scanned: number;
  /** Candidates dropped because they aren't verified Norwegian companies. */
  rejectedForeign: number;
  /** Candidates dropped as duplicates of a lead we already have (any source). */
  rejectedDuplicate: number;
  /** Apollo matches skipped because we've already imported that exact person.
   *  When this is high and imported is 0, the search pool is simply exhausted. */
  alreadyHave: number;
  /** Candidates skipped because their company already hit the per-company cap
   *  this run — keeps one big employer from flooding the whole import. */
  rejectedSameCompany: number;
  /** DB ids of the leads inserted this run, so callers can auto-enrich them. */
  insertedIds: string[];
  error?: string;
}

/** Stop scanning after this many candidates so a low match-rate run can't run
 *  past the serverless time budget (each candidate does a brreg lookup). */
const MAX_SCAN = 250;

/** Max leads to import per company per run (counting what we already have), so a
 *  big employer like "Møller Bil" can't flood a niche with 12 of its managers —
 *  we want a spread of different companies to call, not one company many times. */
const MAX_PER_COMPANY = 1;

/** Company-size bands to sweep when no specific size is chosen. Apollo caps a
 *  single search at ~100 records, so querying each band separately reaches a
 *  fresh slice of the database each time — many more new leads per run. */
const SIZE_BUCKETS = ["1,10", "11,50", "51,200", "201,1000", "1001,5000", "5001,"];

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
  opts: {
    keywords?: string;
    keywordTags?: string[];
    nicheId?: string | null;
    titles?: string[];
    locations?: string[];
    employeeRanges?: string[];
  } = {}
): Promise<ApolloFetchResult> {
  if (!process.env.APOLLO_API_KEY && process.env.DEMO_MOCK !== "1") {
    return { ok: false, imported: 0, autoClassified: 0, scanned: 0, rejectedForeign: 0, rejectedDuplicate: 0, rejectedSameCompany: 0, alreadyHave: 0, insertedIds: [], error: "APOLLO_API_KEY mangler." };
  }

  const supabase = createAdminClient();
  const target = Math.max(1, Math.min(200, Math.floor(limit) || 0));

  const { data: nichesData } = await supabase.from("niches").select("*");
  const niches = (nichesData as Niche[] | null) ?? [];

  // Existing leads: Apollo ids (so we never import the same person twice) and
  // company+role signatures (so we don't re-import someone we already have from
  // HubSpot or an earlier run, even though the Apollo search masks their name).
  const { data: existingData } = await supabase
    .from("leads")
    .select("apollo_person_id, company_name, job_title");
  const seen = new Set<string>();
  const sigSeen = new Set<string>();
  // How many leads we already have per company, so a run tops each company up to
  // MAX_PER_COMPANY rather than re-flooding one we're already covered on.
  const companyCount = new Map<string, number>();
  for (const r of (existingData as { apollo_person_id: string | null; company_name: string | null; job_title: string | null }[] | null) ?? []) {
    if (r.apollo_person_id) seen.add(r.apollo_person_id);
    const sig = companyTitleKey(r.company_name, r.job_title);
    if (sig) sigSeen.add(sig);
    const ck = normCompany(r.company_name);
    if (ck) companyCount.set(ck, (companyCount.get(ck) ?? 0) + 1);
  }

  let imported = 0;
  let autoClassified = 0;
  let scanned = 0;
  let rejectedForeign = 0;
  let rejectedDuplicate = 0;
  let rejectedSameCompany = 0;
  let alreadyHave = 0;
  const insertedIds: string[] = [];
  // Cache brreg lookups within a run (many rows can share a company name).
  const brregCache = new Map<string, BrregMatch | null>();

  // When the admin didn't pin a company size, sweep across size buckets: Apollo
  // caps a single query at ~100 records, so querying each band separately reaches
  // a fresh slice of the database — far more new (unseen) companies per run.
  const buckets = opts.employeeRanges?.length
    ? [opts.employeeRanges]
    : SIZE_BUCKETS.map((b) => [b]);
  let bucketIdx = 0;
  let page = 1;

  try {
    while (bucketIdx < buckets.length && imported < target && scanned < MAX_SCAN) {
      const { people } = await searchApolloPeople({
        titles: opts.titles?.length ? opts.titles : ICP_TITLES,
        locations: opts.locations?.length ? opts.locations : ICP_LOCATIONS,
        page,
        perPage: PER_PAGE,
        keywords: opts.keywords,
        keywordTags: opts.keywordTags,
        employeeRanges: buckets[bucketIdx],
      });
      if (people.length === 0) {
        bucketIdx++;
        page = 1;
        continue; // this size band is exhausted — move to the next
      }

      const rows = [];
      for (const p of people) {
        if (imported + rows.length >= target || scanned >= MAX_SCAN) break;
        if (seen.has(p.apolloId)) {
          alreadyHave++;
          continue; // already imported this exact person on an earlier run
        }
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

        // Cross-source dedup: skip if we already have this role at this company
        // (from HubSpot or a prior run). Prevents two sellers on the same person.
        const sig = companyTitleKey(p.companyName, p.jobTitle);
        if (sig && sigSeen.has(sig)) {
          rejectedDuplicate++;
          continue;
        }

        // Per-company cap: don't let one big employer (e.g. "Møller Bil") fill the
        // import with a dozen of its managers — spread across companies instead.
        const ckey = normCompany(p.companyName);
        if (ckey && (companyCount.get(ckey) ?? 0) >= MAX_PER_COMPANY) {
          rejectedSameCompany++;
          continue;
        }

        if (sig) sigSeen.add(sig);
        if (ckey) companyCount.set(ckey, (companyCount.get(ckey) ?? 0) + 1);

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
        const ids = (inserted ?? []).map((r) => r.id as string);
        imported += ids.length;
        insertedIds.push(...ids);
      }

      page++;
      if (page > MAX_PAGES) {
        bucketIdx++;
        page = 1; // exhausted this band's pages — move to the next size band
      }
    }

    return { ok: true, imported, autoClassified, scanned, rejectedForeign, rejectedDuplicate, rejectedSameCompany, alreadyHave, insertedIds };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, imported, autoClassified, scanned, rejectedForeign, rejectedDuplicate, rejectedSameCompany, alreadyHave, insertedIds, error: message };
  }
}
