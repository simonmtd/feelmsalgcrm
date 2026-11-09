import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

/** Who is calling the public lead API. */
export type ApiCaller =
  | { kind: "admin"; name: string }
  /** Per-seller key: every lead it sends is assigned to this seller. */
  | { kind: "seller"; name: string; keyId: string; sellerId: string };

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function bearer(request: Request): string | null {
  const h = request.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1].trim() : null;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Resolves `Authorization: Bearer <key>` to a caller. The LEADS_API_KEY env var
 * is the admin key (must name `assigned_to` per lead); keys in `api_keys` are
 * looked up by SHA-256 hash and, when bound to a seller, decide the seller.
 */
export async function authenticateApiRequest(request: Request, admin: Admin): Promise<ApiCaller | null> {
  const key = bearer(request);
  if (!key) return null;

  const envKey = process.env.LEADS_API_KEY;
  if (envKey && safeEqual(key, envKey)) return { kind: "admin", name: "LEADS_API_KEY" };

  const { data } = await admin
    .from("api_keys")
    .select("id, name, seller_id, revoked_at")
    .eq("key_hash", hashApiKey(key))
    .maybeSingle();
  const row = data as { id: string; name: string; seller_id: string | null; revoked_at: string | null } | null;
  if (!row || row.revoked_at) return null;

  await admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", row.id);
  return row.seller_id
    ? { kind: "seller", name: row.name, keyId: row.id, sellerId: row.seller_id }
    : { kind: "admin", name: row.name };
}

export interface ApiSeller {
  id: string;
  email: string;
  handle: string;
}

/**
 * Active sellers keyed by their API handle (lowercase). The handle is
 * `profiles.handle` when set; otherwise the first name from full_name (or the
 * email's local part), used only when no other seller shares it. Adding a seller
 * to the API is therefore just giving their profile a handle.
 */
export async function loadApiSellers(admin: Admin): Promise<Map<string, ApiSeller>> {
  const { data } = await admin
    .from("profiles")
    .select("id, email, full_name, handle, is_active")
    .eq("is_active", true);
  const rows =
    (data as { id: string; email: string; full_name: string | null; handle: string | null }[] | null) ?? [];

  const byHandle = new Map<string, ApiSeller>();
  for (const r of rows) {
    const h = normalizeHandle(r.handle);
    if (h) byHandle.set(h, { id: r.id, email: r.email, handle: h });
  }

  // Fallback handles for profiles without an explicit one; drop ambiguous ones.
  const fallback = new Map<string, ApiSeller | null>();
  for (const r of rows) {
    if (r.handle?.trim()) continue;
    const h = normalizeHandle(r.full_name?.split(/\s+/)[0] || r.email.split("@")[0]);
    if (!h || byHandle.has(h)) continue;
    fallback.set(h, fallback.has(h) ? null : { id: r.id, email: r.email, handle: h });
  }
  for (const [h, s] of fallback) if (s) byHandle.set(h, s);
  return byHandle;
}

/** "Simon " / "SIMON" → "simon"; used for both stored and requested handles. */
export function normalizeHandle(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9æøå]+/g, "");
}
