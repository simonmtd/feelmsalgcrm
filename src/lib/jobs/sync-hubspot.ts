import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchHubspotContacts } from "@/lib/hubspot";
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

      for (const contact of results) {
        const p = contact.properties;
        const contactName = [p.firstname, p.lastname].filter(Boolean).join(" ") || null;

        const { data: row, error } = await supabase
          .from("leads")
          .upsert(
            {
              hubspot_contact_id: contact.id,
              company_name: p.company ?? null,
              contact_name: contactName,
              email: p.email ?? null,
              phone: p.phone ?? null,
              website: p.website ?? null,
              industry: p.industry ?? null,
              job_title: p.jobtitle ?? null,
              source: "hubspot",
              raw_hubspot_data: contact,
            },
            { onConflict: "hubspot_contact_id" }
          )
          .select("id, niche_id")
          .single();

        if (error) continue;
        recordsSynced += 1;

        // Only classify leads that aren't already assigned to a niche, so an
        // admin's manual classification is never overwritten.
        const lead = row as { id: string; niche_id: string | null } | null;
        if (lead && !lead.niche_id) {
          const match = matchNiche(niches, {
            company: p.company,
            industry: p.industry,
            website: p.website,
            title: p.jobtitle,
          });
          if (match) {
            await supabase.from("leads").update({ niche_id: match.id }).eq("id", lead.id);
            autoClassified += 1;
          }
        }
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
