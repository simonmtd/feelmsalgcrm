import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is
 * configured as an env var. Reject any request that doesn't present it so
 * these endpoints can't be triggered by outsiders. The comparison is
 * constant-time to avoid leaking the secret through response timing.
 */
export function isAuthorizedCronRequest(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const provided = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;

  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch, so guard first (the length check
  // itself is not secret-dependent).
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}
