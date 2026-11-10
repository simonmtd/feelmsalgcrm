import "server-only";
import { fetchAll } from "@/lib/fetch-all";
import type { createAdminClient } from "@/lib/supabase/admin";
import { normEmail, companyTitleKey, companyContactKey, mobileKey, normCompany } from "@/lib/dedup";

/** The fields of an incoming lead that dedup looks at. */
export interface DedupFields {
  apolloId?: string | null;
  email?: string | null;
  company?: string | null;
  contact?: string | null;
  title?: string | null;
  phone?: string | null;
}

export type DedupKey = "apollo_id" | "email" | "company_contact" | "company_title" | "mobile";

export interface DedupHit {
  matchedOn: DedupKey;
  /** Id of the existing lead it collides with (null when it collided with a
   *  row reserved earlier in the same batch that hasn't been inserted yet). */
  leadId: string | null;
}

function keysOf(f: DedupFields): [DedupKey, string | null][] {
  return [
    ["apollo_id", f.apolloId?.trim() || null],
    ["email", normEmail(f.email)],
    ["company_contact", companyContactKey(f.company, f.contact)],
    ["company_title", companyTitleKey(f.company, f.title)],
    ["mobile", mobileKey(f.phone)],
  ];
}

/**
 * In-memory index of every existing lead (any source, any status) on the keys
 * we dedup on: Apollo id, email, company+contact, company+title and Norwegian
 * mobile. A lead matching on just one of them is treated as a duplicate.
 */
export class LeadDedupIndex {
  private maps = new Map<DedupKey, Map<string, string | null>>();

  find(f: DedupFields): DedupHit | null {
    for (const [k, v] of keysOf(f)) {
      if (v && this.maps.get(k)?.has(v)) {
        return { matchedOn: k, leadId: this.maps.get(k)!.get(v) ?? null };
      }
    }
    return null;
  }

  /** Record a lead so later rows in the same batch dedup against it too. */
  add(f: DedupFields, leadId: string | null = null) {
    for (const [k, v] of keysOf(f)) {
      if (!v) continue;
      let m = this.maps.get(k);
      if (!m) this.maps.set(k, (m = new Map()));
      if (!m.has(v)) m.set(v, leadId);
    }
  }
}

export async function loadLeadDedupIndex(
  admin: ReturnType<typeof createAdminClient>
): Promise<LeadDedupIndex> {
  const data = await fetchAll((from, to) =>
    admin
      .from("leads")
      .select("id, apollo_person_id, email, company_name, contact_name, job_title, phone")
      .order("id")
      .range(from, to)
  );
  const index = new LeadDedupIndex();
  for (const r of (data as {
    id: string;
    apollo_person_id: string | null;
    email: string | null;
    company_name: string | null;
    contact_name: string | null;
    job_title: string | null;
    phone: string | null;
  }[] | null) ?? []) {
    index.add(
      {
        apolloId: r.apollo_person_id,
        email: r.email,
        company: r.company_name,
        contact: r.contact_name,
        title: r.job_title,
        phone: r.phone,
      },
      r.id
    );
  }
  return index;
}

/** Normalized names of every company the team has ever logged a call to. */
export async function loadCalledCompanies(
  admin: ReturnType<typeof createAdminClient>
): Promise<Set<string>> {
  const calls = await fetchAll((from, to) =>
    admin.from("call_logs").select("company_name").not("company_name", "is", null).order("id").range(from, to)
  );
  const called = new Set<string>();
  for (const c of (calls as { company_name: string | null }[] | null) ?? []) {
    const k = normCompany(c.company_name);
    if (k) called.add(k);
  }
  return called;
}
