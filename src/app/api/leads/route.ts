import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiRequest } from "@/lib/api-keys";
import { checkRateLimit, recordFailure } from "@/lib/rate-limit";
import { API_BATCH_MAX, ingestApiLeads, lookupLeads, normDomain, validEmail } from "@/lib/lead-api";
import { normEmail } from "@/lib/dedup";

/**
 * Public lead API for the sellers' Grok bots. Auth: `Authorization: Bearer <key>`
 * — either LEADS_API_KEY (admin; every lead must name `assigned_to`) or a key
 * from `api_keys` (bound to one seller, who then gets every lead it sends).
 *
 *   POST /api/leads   body: one lead object, or { leads: [...] }
 *   GET  /api/leads?email=ola@firma.no   |   GET /api/leads?domain=firma.no
 */

async function auth(request: Request, admin: ReturnType<typeof createAdminClient>) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rateKey = `leads-api:${ip}`;
  const rl = checkRateLimit(rateKey);
  if (rl.blocked) {
    return {
      error: NextResponse.json(
        { error: "too_many_failed_attempts" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      ),
    };
  }
  const caller = await authenticateApiRequest(request, admin);
  if (!caller) {
    recordFailure(rateKey);
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  return { caller };
}

export async function POST(request: Request) {
  const admin = createAdminClient();
  const a = await auth(request, admin);
  if (a.error) return a.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const leads: unknown[] = Array.isArray(body)
    ? body
    : body && typeof body === "object" && Array.isArray((body as { leads?: unknown }).leads)
      ? (body as { leads: unknown[] }).leads
      : body && typeof body === "object"
        ? [body]
        : [];
  if (leads.length === 0) {
    return NextResponse.json({ error: "no_leads", message: "Send ett lead-objekt eller { leads: [...] }" }, { status: 400 });
  }
  if (leads.length > API_BATCH_MAX) {
    return NextResponse.json(
      { error: "too_many_leads", message: `Maks ${API_BATCH_MAX} leads per kall (fikk ${leads.length})` },
      { status: 413 }
    );
  }

  try {
    const { created, rejected } = await ingestApiLeads(admin, a.caller, leads);
    return NextResponse.json(
      { created, rejected, summary: { received: leads.length, created: created.length, rejected: rejected.length } },
      { status: created.length > 0 ? 201 : 200 }
    );
  } catch (error) {
    console.error("[api/leads POST]", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const admin = createAdminClient();
  const a = await auth(request, admin);
  if (a.error) return a.error;

  const params = new URL(request.url).searchParams;
  const rawEmail = params.get("email");
  const rawDomain = params.get("domain");

  let q: { email: string } | { domain: string };
  if (rawEmail) {
    const email = normEmail(rawEmail);
    if (!validEmail(email)) return NextResponse.json({ error: "invalid_email" }, { status: 400 });
    q = { email: email! };
  } else if (rawDomain) {
    const domain = normDomain(rawDomain);
    if (!domain) return NextResponse.json({ error: "invalid_domain" }, { status: 400 });
    q = { domain };
  } else {
    return NextResponse.json({ error: "missing_query", message: "Bruk ?email=... eller ?domain=..." }, { status: 400 });
  }

  try {
    const matches = await lookupLeads(admin, q, a.caller.kind === "seller" ? a.caller.sellerId : undefined);
    return NextResponse.json({ query: q, exists: matches.length > 0, count: matches.length, leads: matches });
  } catch (error) {
    console.error("[api/leads GET]", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
