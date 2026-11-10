"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeError } from "@/lib/actions/errors";
import { logAudit } from "@/lib/audit";

const FILLABLE = ["contact_name", "job_title", "email", "phone", "website", "industry", "org_number", "linkedin_url", "city", "country"] as const;

/**
 * Keeps one lead and folds the others into it: their history (activities,
 * calls, meetings) moves to the keeper, the keeper's empty fields are filled
 * from them, and they're marked duplicate_of the keeper and closed as «Tapt»
 * so nobody calls the same person twice.
 */
export async function mergeDuplicates(keeperId: string, duplicateIds: string[]): Promise<{ merged: number; error?: string }> {
  const actor = await requireAdmin();
  const dups = duplicateIds.filter((id) => id && id !== keeperId);
  if (!dups.length) return { merged: 0, error: "Velg minst ett duplikat." };
  const admin = createAdminClient();

  const { data: rows, error: readErr } = await admin
    .from("leads")
    .select(["id", ...FILLABLE].join(", "))
    .in("id", [keeperId, ...dups]);
  if (readErr) return { merged: 0, error: safeError("mergeDuplicates.read", readErr) };
  const byId = new Map(((rows as unknown as Record<string, string | null>[]) ?? []).map((r) => [r.id as string, r]));
  const keeper = byId.get(keeperId);
  if (!keeper) return { merged: 0, error: "Fant ikke leadet som skal beholdes." };

  const fill: Record<string, string> = {};
  for (const f of FILLABLE) {
    if (keeper[f]) continue;
    const v = dups.map((id) => byId.get(id)?.[f]).find(Boolean);
    if (v) fill[f] = v;
  }

  for (const [table, col] of [
    ["lead_activities", "lead_id"],
    ["call_logs", "lead_id"],
    ["meetings", "lead_id"],
  ] as const) {
    const { error } = await admin.from(table).update({ [col]: keeperId }).in(col, dups);
    if (error) return { merged: 0, error: safeError(`mergeDuplicates.${table}`, error) };
  }
  if (Object.keys(fill).length) {
    const { error } = await admin.from("leads").update(fill).eq("id", keeperId);
    if (error) return { merged: 0, error: safeError("mergeDuplicates.fill", error) };
  }
  const { data, error } = await admin
    .from("leads")
    .update({ duplicate_of: keeperId, status: "lost", next_follow_up_at: null })
    .in("id", dups)
    .select("id");
  if (error) return { merged: 0, error: safeError("mergeDuplicates.mark", error) };

  await logAudit(actor, "lead.merge_duplicates", {
    targetType: "lead",
    targetId: keeperId,
    details: { duplicates: dups, filled: Object.keys(fill) },
  });
  revalidatePath("/admin/duplikater");
  revalidatePath("/admin/leads");
  return { merged: data?.length ?? 0 };
}
