import "server-only";

/**
 * Process-local fixed-window rate limiter. Good enough to blunt password
 * brute-forcing on a single instance. NOTE: on serverless/multi-instance
 * hosting this is per-instance, not global — for production hardening back it
 * with a shared store (e.g. Upstash/Redis).
 */
interface Attempt {
  count: number;
  firstAt: number;
  blockedUntil?: number;
}

const WINDOW_MS = 15 * 60 * 1000; // rolling window for counting failures
const MAX_ATTEMPTS = 5; // failures allowed within the window
const BLOCK_MS = 15 * 60 * 1000; // lockout once the limit is hit

declare global {
  var __RATE_LIMIT__: Map<string, Attempt> | undefined;
}
const store: Map<string, Attempt> = (globalThis.__RATE_LIMIT__ ??= new Map());

export interface RateStatus {
  blocked: boolean;
  retryAfterSec: number;
  remaining: number;
}

export function checkRateLimit(key: string): RateStatus {
  const now = Date.now();
  const rec = store.get(key);

  if (rec?.blockedUntil && rec.blockedUntil > now) {
    return { blocked: true, retryAfterSec: Math.ceil((rec.blockedUntil - now) / 1000), remaining: 0 };
  }
  if (rec && now - rec.firstAt > WINDOW_MS) {
    store.delete(key);
    return { blocked: false, retryAfterSec: 0, remaining: MAX_ATTEMPTS };
  }
  const count = rec?.count ?? 0;
  return { blocked: false, retryAfterSec: 0, remaining: Math.max(0, MAX_ATTEMPTS - count) };
}

export function recordFailure(key: string): RateStatus {
  const now = Date.now();
  let rec = store.get(key);
  if (!rec || now - rec.firstAt > WINDOW_MS) rec = { count: 0, firstAt: now };
  rec.count += 1;
  if (rec.count >= MAX_ATTEMPTS) rec.blockedUntil = now + BLOCK_MS;
  store.set(key, rec);
  return checkRateLimit(key);
}

export function clearRateLimit(key: string) {
  store.delete(key);
}
