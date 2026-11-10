"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireProfile } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeError } from "@/lib/actions/errors";
import { logAudit } from "@/lib/audit";
import { matchNiche } from "@/lib/niche-matcher";
import type { Lead, Niche } from "@/lib/types";

function revalidate() {
  revalidatePath("/admin/leads");
  revalidatePath("/leads");
}

/** Sets (or clears) the niche on many leads at once — the bulk bar on /admin/leads. */
export async function bulkSetNiche(
  leadIds: string[],
  nicheId: string | null
): Promise<{ updated: number; error?: string }> {
  const actor = await requireAdmin();
  if (!leadIds.length) return { updated: 0, error: "Ingen leads er valgt." };
  if (leadIds.length > 500) return { updated: 0, error: "Maks 500 leads om gangen." };

  const admin = createAdminClient();
  const { data, error } = await admin.from("leads").update({ niche_id: nicheId }).in("id", leadIds).select("id");
  if (error) return { updated: 0, error: safeError("bulkSetNiche", error) };

  const updated = data?.length ?? 0;
  await logAudit(actor, "lead.bulk_classify", { targetType: "lead", details: { count: updated, nicheId } });
  revalidate();
  return { updated };
}

const AUTO_MAX = 5000;
const PAGE = 1000; // PostgREST returns at most 1000 rows per request by default

/**
 * Auto-sorts niche from company name, industry, website and title, using the
 * same matcher as the imports. Only touches leads *without* a niche, and only
 * sets one when a niche's keyword actually appears, so unclear leads stay for
 * manual sorting. With `leadIds` it works on just those; otherwise on every
 * unclassified lead (up to AUTO_MAX per run).
 */
export async function autoClassifyNiches(
  leadIds?: string[]
): Promise<{ checked: number; classified: number; error?: string }> {
  const actor = await requireAdmin();
  const admin = createAdminClient();

  const { data: nicheRows } = await admin.from("niches").select("*");
  const niches = (nicheRows as Niche[] | null) ?? [];
  if (!niches.length) return { checked: 0, classified: 0, error: "Det finnes ingen nisjer å sortere etter." };

  type Row = Pick<Lead, "id" | "company_name" | "industry" | "website" | "job_title">;
  const rows: Row[] = [];
  if (leadIds?.length) {
    for (let i = 0; i < leadIds.length; i += PAGE) {
      const { data } = await admin
        .from("leads")
        .select("id, company_name, industry, website, job_title")
        .in("id", leadIds.slice(i, i + PAGE))
        .is("niche_id", null);
      rows.push(...((data as Row[] | null) ?? []));
    }
  } else {
    for (let from = 0; from < AUTO_MAX; from += PAGE) {
      const { data } = await admin
        .from("leads")
        .select("id, company_name, industry, website, job_title")
        .is("niche_id", null)
        .order("created_at", { ascending: false })
        .range(from, from + PAGE - 1);
      const page = (data as Row[] | null) ?? [];
      rows.push(...page);
      if (page.length < PAGE) break;
    }
  }

  // One UPDATE per niche instead of one per lead.
  const byNiche = new Map<string, string[]>();
  for (const r of rows) {
    const n = matchNiche(niches, { company: r.company_name, industry: r.industry, website: r.website, title: r.job_title });
    if (n) byNiche.set(n.id, [...(byNiche.get(n.id) ?? []), r.id]);
  }

  let classified = 0;
  for (const [nicheId, ids] of byNiche) {
    for (let i = 0; i < ids.length; i += 500) {
      const { data, error } = await admin
        .from("leads")
        .update({ niche_id: nicheId })
        .in("id", ids.slice(i, i + 500))
        .is("niche_id", null)
        .select("id");
      if (error) return { checked: rows.length, classified, error: safeError("autoClassifyNiches", error) };
      classified += data?.length ?? 0;
    }
  }

  await logAudit(actor, "lead.auto_classify", {
    targetType: "lead",
    details: { checked: rows.length, classified, scoped: !!leadIds?.length },
  });
  revalidate();
  return { checked: rows.length, classified };
}

export interface LeadPreview {
  lead: Lead;
  sellerName: string | null;
  activities: { id: string; type: string; content: string; created_at: string; seller: string | null }[];
}

/** Everything the lead side panel shows. Admins see any lead; sellers only their own. */
export async function getLeadPreview(leadId: string): Promise<LeadPreview | null> {
  const profile = await requireProfile();
  const admin = createAdminClient();

  const [{ data: lead }, { data: acts }] = await Promise.all([
    admin
      .from("leads")
      .select("*, niche:niches(*), assigned_seller:profiles!leads_assigned_to_fkey(id, full_name, email)")
      .eq("id", leadId)
      .maybeSingle(),
    admin
      .from("lead_activities")
      .select("id, type, content, created_at, seller:profiles(full_name, email)")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (!lead) return null;

  const l = lead as Lead;
  if (profile.role !== "admin" && l.assigned_to !== profile.id) return null;
  return {
    lead: l,
    sellerName: l.assigned_seller ? l.assigned_seller.full_name ?? l.assigned_seller.email : null,
    activities: ((acts as unknown as {
      id: string;
      type: string;
      content: string;
      created_at: string;
      seller: { full_name: string | null; email: string } | null;
    }[] | null) ?? []).map((a) => ({
      id: a.id,
      type: a.type,
      content: a.content,
      created_at: a.created_at,
      seller: a.seller ? a.seller.full_name ?? a.seller.email : null,
    })),
  };
}
