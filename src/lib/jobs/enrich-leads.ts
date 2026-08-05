import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  enrichPerson,
  splitName,
  toDomain,
  enrichmentUpdate,
  APOLLO_NO_CREDITS,
  type LeadEnrichSnapshot,
} from "@/lib/apollo";
import { matchNiche } from "@/lib/niche-matcher";
import { normEmail } from "@/lib/dedup";
import type { Niche } from "@/lib/types";

/** A lead row the enrichment loop needs: the enrichable snapshot plus identity. */
export type EnrichableLead = LeadEnrichSnapshot & {
  id: string;
  contact_name: string | null;
  apollo_person_id: string | null;
  niche_id: string | null;
};

export interface EnrichRunStats {
  processed: number;
  phonePending: number;
  duplicates: number;
  filled: Record<string, number>;
  /** Set when Apollo ran out of credits mid-run — the loop stops early. */
  noCredits: boolean;
}

/**
 * Reveals contact info (email now, phone shortly after via the webhook) for a
 * set of leads via Apollo, fill-if-missing so manual entries survive. Each
 * processed lead can cost ~8 Apollo credits. Shared by the admin bulk-enrich
 * action and the auto-enrich step after an Apollo import. Stops the whole run
 * on the first out-of-credits error, since every further call would fail too.
 */
export async function enrichLeadRows(
  admin: ReturnType<typeof createAdminClient>,
  rows: EnrichableLead[],
  niches: Niche[]
): Promise<EnrichRunStats> {
  let processed = 0;
  let phonePending = 0;
  let duplicates = 0;
  let noCredits = false;
  const filled: Record<string, number> = {};

  for (const lead of rows) {
    try {
      const { first, last } = splitName(lead.contact_name);
      const result = await enrichPerson({
        apolloId: lead.apollo_person_id,
        firstName: first,
        lastName: last,
        organizationName: lead.company_name,
        domain: toDomain(lead.website),
        email: lead.email,
      });
      const { update, filled: fills } = enrichmentUpdate(lead, result);
      update.apollo_person_id = result.apolloPersonId ?? lead.apollo_person_id;
      update.enriched_at = new Date().toISOString();
      if (!lead.niche_id) {
        const niche = matchNiche(niches, {
          company: lead.company_name ?? result.organizationName,
          industry: lead.industry ?? result.industry,
          website: lead.website ?? result.website,
          title: lead.job_title ?? result.jobTitle,
        });
        if (niche) update.niche_id = niche.id;
      }
      // Cross-source dedup on a newly-revealed email.
      const newEmail = normEmail(update.email as string | undefined);
      if (newEmail) {
        const { data: dup } = await admin
          .from("leads")
          .select("id")
          .neq("id", lead.id)
          .ilike("email", newEmail)
          .is("duplicate_of", null)
          .limit(1)
          .maybeSingle();
        if (dup) {
          update.status = "lost";
          update.duplicate_of = dup.id;
          duplicates++;
        }
      }
      await admin.from("leads").update(update).eq("id", lead.id);
      processed++;
      if (result.phonePending) phonePending++;
      for (const f of fills) filled[f] = (filled[f] ?? 0) + 1;
    } catch (err) {
      // Out of Apollo credits: stop the whole run (every further call fails).
      if (err instanceof Error && err.message === APOLLO_NO_CREDITS) {
        noCredits = true;
        break;
      }
      // One bad lead shouldn't abort the whole run.
      console.error("[enrichLeadRows] lead failed", lead.id, err);
    }
  }

  return { processed, phonePending, duplicates, filled, noCredits };
}
