"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeError } from "@/lib/actions/errors";
import { API_BATCH_MAX, ingestApiLeads } from "@/lib/lead-api";
import type { ApiCaller } from "@/lib/api-keys";

export interface GrokImportResult {
  ok: boolean;
  message: string;
  created: { id: string; label: string; assignedTo: string; warnings?: string[] }[];
  rejected: { label: string; message: string; duplicateOf?: string | null }[];
}

/** Pulls the lead JSON out of a Grok answer: tolerates ```json fences and
 *  text before/after, and accepts an array, { leads: [...] } or one object. */
function extractLeads(text: string): unknown[] | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)?.[1];
  const candidates = [fenced, text].filter((t): t is string => !!t?.trim());
  for (const c of candidates) {
    const trimmed = c.trim();
    const starts = [trimmed.indexOf("["), trimmed.indexOf("{")].filter((i) => i >= 0);
    for (const start of starts.sort((a, b) => a - b)) {
      const end = Math.max(trimmed.lastIndexOf("]"), trimmed.lastIndexOf("}"));
      if (end <= start) continue;
      try {
        const v: unknown = JSON.parse(trimmed.slice(start, end + 1));
        if (Array.isArray(v)) return v;
        if (v && typeof v === "object") {
          const leads = (v as { leads?: unknown }).leads;
          return Array.isArray(leads) ? leads : [v];
        }
      } catch {
        // try the next candidate
      }
    }
  }
  return null;
}

function labelOf(raw: unknown, index: number): string {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const s = (k: string) => (typeof r[k] === "string" ? (r[k] as string).trim() : "");
  const name = [s("first_name"), s("last_name")].filter(Boolean).join(" ");
  return [name, s("company_name")].filter(Boolean).join(" · ") || `Lead #${index + 1}`;
}

/**
 * Imports leads pasted from a Grok chat. Runs the exact same pipeline as
 * POST /api/leads. A seller's paste is always assigned to themselves; an
 * admin's paste is assigned per lead via `assigned_to`.
 */
export async function importGrokLeads(text: string): Promise<GrokImportResult> {
  const profile = await requireProfile();
  const empty = { created: [], rejected: [] };

  const leads = extractLeads(text ?? "");
  if (!leads || leads.length === 0) {
    return { ok: false, message: "Fant ingen leads. Lim inn hele JSON-svaret fra Grok.", ...empty };
  }
  if (leads.length > API_BATCH_MAX) {
    return { ok: false, message: `Maks ${API_BATCH_MAX} leads per innliming (fikk ${leads.length}).`, ...empty };
  }

  const caller: ApiCaller =
    profile.role === "admin"
      ? { kind: "admin", name: `lim-inn:${profile.email}` }
      : { kind: "seller", name: `lim-inn:${profile.email}`, keyId: "paste", sellerId: profile.id };

  try {
    const { created, rejected } = await ingestApiLeads(createAdminClient(), caller, leads);
    revalidatePath("/leads");
    revalidatePath("/admin/leads");
    revalidatePath("/dashboard");
    const message =
      `${created.length} av ${leads.length} leads lagt inn` +
      (rejected.length ? `, ${rejected.length} avvist.` : ".");
    return {
      ok: true,
      message,
      created: created.map((c) => ({
        id: c.id,
        label: labelOf(leads[c.index], c.index),
        assignedTo: c.assigned_to,
        warnings: c.warnings,
      })),
      rejected: rejected.map((r) => ({
        label: labelOf(leads[r.index], r.index),
        message: r.message,
        duplicateOf: r.duplicate_of,
      })),
    };
  } catch (error) {
    return { ok: false, message: safeError("importGrokLeads", error), ...empty };
  }
}
