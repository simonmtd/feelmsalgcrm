import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchHubspotContacts,
  fetchHubspotCompanies,
  readableIndustry,
} from "@/lib/hubspot";
import { matchNiche } from "@/lib/niche-matcher";
import type { Niche } from "@/lib/types";

export interface SyncResult {
  ok: boolean;
  recordsSynced: number;
  autoClassified: number;
  error?: string;
}

/**
 * Pulls contacts from HubSpot and upserts them into public.leads, matched on
 * hubspot_contact_id. Contact-info + enrichment columns (company, name, email,
 * phone, website, industry, title) are refreshed from HubSpot on every run.
 * Niche, status, assignment, and seller-entered fields are left untouched on
 * existing rows. New/unclassified leads get an automatic niche when their text
 * matches one; unmatched leads stay unclassified for manual review.
 */
export async function runHubspotSync(): Promise<SyncResult> {
  const supabase = createAdminClient();

  const { data: run } = await supabase
    .from("sync_runs")
    .insert({ status: "running" })
    .select()
    .single();

  const { data: nichesData } = await supabase.from("niches").select("*");
  const niches = (nichesData as Niche[] | null) ?? [];

  let recordsSynced = 0;
  let autoClassified = 0;

  try {
    let after: string | undefined;
    do {
      const { results, nextAfter } = await fetchHubspotContacts(after);
      after = nextAfter;

      // Resolve the associated company for every contact on this page in one
      // batched call, so we can enrich with company name, industry and domain.
      const companyIds = results.flatMap(
        (c) => c.associations?.companies?.results?.map((r) => r.id) ?? []
      );
      const companies = await fetchHubspotCompanies(companyIds);

      // Build all rows for this page, then write them in ONE bulk upsert. Doing
      // it per-contact (a round-trip each) blew past Vercel's function timeout
      // on large accounts.
      const records = results.map((contact) => {
        const p = contact.properties;
        const contactName = [p.firstname, p.lastname].filter(Boolean).join(" ") || null;
        const companyId = contact.associations?.companies?.results?.[0]?.id;
        const company = companyId ? companies.get(companyId) : undefined;
        return {
          hubspot_contact_id: contact.id,
          company_name: p.company ?? company?.name ?? null,
          contact_name: contactName,
          email: p.email ?? null,
          phone: p.phone ?? null,
          website: p.website ?? company?.domain ?? null,
          industry: readableIndustry(p.industry ?? company?.industry),
          job_title: p.jobtitle ?? null,
          source: "hubspot",
          raw_hubspot_data: contact,
        };
      });

      if (records.length === 0) continue;

      const { data: rows, error } = await supabase
        .from("leads")
        .upsert(records, { onConflict: "hubspot_contact_id" })
        .select("id, niche_id, company_name, industry, website, job_title");
      if (error) throw new Error(error.message);

      const upserted = (rows ?? []) as {
        id: string;
        niche_id: string | null;
        company_name: string | null;
        industry: string | null;
        website: string | null;
        job_title: string | null;
      }[];
      recordsSynced += upserted.length;

      // Group still-unclassified leads by their matched niche, then apply one
      // bulk update per niche. Admin's manual classification (niche_id set) is
      // never touched.
      const byNiche = new Map<string, string[]>();
      for (const lead of upserted) {
        if (lead.niche_id) continue;
        const match = matchNiche(niches, {
          company: lead.company_name,
          industry: lead.industry,
          website: lead.website,
          title: lead.job_title,
        });
        if (match) {
          const ids = byNiche.get(match.id) ?? [];
          ids.push(lead.id);
          byNiche.set(match.id, ids);
        }
      }
      for (const [nicheId, ids] of byNiche) {
        await supabase.from("leads").update({ niche_id: nicheId }).in("id", ids);
        autoClassified += ids.length;
      }
    } while (after);

    if (run) {
      await supabase
        .from("sync_runs")
        .update({
          status: "success",
          finished_at: new Date().toISOString(),
          records_synced: recordsSynced,
        })
        .eq("id", run.id);
    }

    return { ok: true, recordsSynced, autoClassified };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (run) {
      await supabase
        .from("sync_runs")
        .update({
          status: "error",
          finished_at: new Date().toISOString(),
          records_synced: recordsSynced,
          error: message,
        })
        .eq("id", run.id);
    }
    return { ok: false, recordsSynced, autoClassified, error: message };
  }
}
