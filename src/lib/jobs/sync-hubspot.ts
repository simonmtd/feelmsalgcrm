import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchHubspotContacts } from "@/lib/hubspot";

export interface SyncResult {
  ok: boolean;
  recordsSynced: number;
  error?: string;
}

/**
 * Pulls contacts from HubSpot and upserts them into public.leads, matched on
 * hubspot_contact_id. Only overwrites contact-info columns — niche, status,
 * assignment, and seller-entered fields are left untouched on existing rows.
 */
export async function runHubspotSync(): Promise<SyncResult> {
  const supabase = createAdminClient();

  const { data: run } = await supabase
    .from("sync_runs")
    .insert({ status: "running" })
    .select()
    .single();

  let recordsSynced = 0;

  try {
    let after: string | undefined;
    do {
      const { results, nextAfter } = await fetchHubspotContacts(after);
      after = nextAfter;

      for (const contact of results) {
        const p = contact.properties;
        const contactName = [p.firstname, p.lastname].filter(Boolean).join(" ") || null;

        const { error } = await supabase.from("leads").upsert(
          {
            hubspot_contact_id: contact.id,
            company_name: p.company ?? null,
            contact_name: contactName,
            email: p.email ?? null,
            phone: p.phone ?? null,
            source: "hubspot",
            raw_hubspot_data: contact,
          },
          { onConflict: "hubspot_contact_id" }
        );

        if (!error) recordsSynced += 1;
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

    return { ok: true, recordsSynced };
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
    return { ok: false, recordsSynced, error: message };
  }
}
