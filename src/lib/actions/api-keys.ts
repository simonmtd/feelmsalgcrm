"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeError } from "@/lib/actions/errors";
import { logAudit } from "@/lib/audit";
import { hashApiKey, normalizeHandle } from "@/lib/api-keys";

export interface ApiKeyRow {
  id: string;
  name: string;
  seller_id: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

/** Creates a key for the lead API. The plaintext is returned once and never stored. */
export async function createApiKey(
  name: string,
  sellerId: string | null
): Promise<{ key?: string; error?: string }> {
  const actor = await requireAdmin();
  const clean = name.trim().slice(0, 80);
  if (!clean) return { error: "Gi nøkkelen et navn, f.eks. «grok-simon»." };

  const key = `fl_${randomBytes(24).toString("hex")}`;
  const admin = createAdminClient();
  const { error } = await admin.from("api_keys").insert({ name: clean, seller_id: sellerId || null, key_hash: hashApiKey(key) });
  if (error) return { error: safeError("createApiKey", error) };

  await logAudit(actor, "api_key.create", { targetType: "api_key", details: { name: clean, sellerId } });
  revalidatePath("/admin/settings");
  return { key };
}

export async function revokeApiKey(id: string): Promise<{ error?: string }> {
  const actor = await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: safeError("revokeApiKey", error) };
  await logAudit(actor, "api_key.revoke", { targetType: "api_key", targetId: id });
  revalidatePath("/admin/settings");
  return {};
}

/** Sets the short name a seller is addressed by in the API's `assigned_to`. */
export async function setSellerHandle(sellerId: string, handle: string): Promise<{ error?: string }> {
  const actor = await requireAdmin();
  const h = normalizeHandle(handle);
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ handle: h || null }).eq("id", sellerId);
  if (error) {
    return { error: (error as { code?: string }).code === "23505" ? `«${h}» er allerede i bruk.` : safeError("setSellerHandle", error) };
  }
  await logAudit(actor, "seller.set_handle", { targetType: "profile", targetId: sellerId, details: { handle: h } });
  revalidatePath("/admin/settings");
  return {};
}
