import "server-only";
import { fetchAll } from "@/lib/fetch-all";
import { normEmail, companyContactKey, mobileKey } from "@/lib/dedup";
import type { createAdminClient } from "@/lib/supabase/admin";

export interface DupLead {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  source: string;
  assigned_to: string | null;
  created_at: string;
  last_call_at: string | null;
}

export interface DupGroup {
  /** Why these look like the same person, e.g. «samme e-post». */
  reasons: string[];
  leads: DupLead[];
}

const REASON: Record<string, string> = { email: "samme e-post", mobile: "samme mobil", contact: "samme navn i samme firma" };

/**
 * Groups existing leads that are probably the same person (same email, same
 * Norwegian mobile, or same contact at the same company). Leads already
 * marked as duplicates are left out. Union-find so A~B~C becomes one group.
 */
export async function findDuplicateGroups(admin: ReturnType<typeof createAdminClient>): Promise<DupGroup[]> {
  const leads = await fetchAll<DupLead>((from, to) =>
    admin
      .from("leads")
      .select("id, company_name, contact_name, job_title, email, phone, status, source, assigned_to, created_at, last_call_at")
      .is("duplicate_of", null)
      .order("id")
      .range(from, to)
  );

  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(x, r);
    return r;
  };
  const reasonsByRoot = new Map<string, Set<string>>();
  for (const l of leads) parent.set(l.id, l.id);

  const firstByKey = new Map<string, string>();
  const link = (key: string, kind: string, id: string) => {
    const other = firstByKey.get(key);
    if (!other) return void firstByKey.set(key, id);
    const a = find(other);
    const b = find(id);
    const merged = new Set([...(reasonsByRoot.get(a) ?? []), ...(reasonsByRoot.get(b) ?? []), kind]);
    parent.set(b, a);
    reasonsByRoot.set(a, merged);
  };

  for (const l of leads) {
    const e = normEmail(l.email);
    if (e) link(`e:${e}`, "email", l.id);
    const m = mobileKey(l.phone);
    if (m) link(`m:${m}`, "mobile", l.id);
    const c = companyContactKey(l.company_name, l.contact_name);
    if (c) link(`c:${c}`, "contact", l.id);
  }

  const groups = new Map<string, DupLead[]>();
  for (const l of leads) {
    const r = find(l.id);
    groups.set(r, [...(groups.get(r) ?? []), l]);
  }
  return [...groups.entries()]
    .filter(([, ls]) => ls.length > 1)
    .map(([root, ls]) => ({
      reasons: [...(reasonsByRoot.get(root) ?? [])].map((k) => REASON[k] ?? k),
      // Oldest first: the original is usually the one to keep.
      leads: ls.sort((a, b) => a.created_at.localeCompare(b.created_at)),
    }))
    .sort((a, b) => b.leads.length - a.leads.length);
}
