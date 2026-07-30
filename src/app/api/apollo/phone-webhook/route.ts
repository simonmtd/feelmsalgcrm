import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parsePhoneWebhook } from "@/lib/apollo";

/**
 * Receives Apollo's asynchronous phone-reveal callback and writes the number
 * onto the matching lead (by apollo_person_id). Protected by a shared secret in
 * the query string, since Apollo webhooks aren't signed. Only fills phone when
 * the lead is still missing one, so it never clobbers a manually entered number.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  const expected = process.env.APOLLO_WEBHOOK_SECRET ?? process.env.CRON_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const pairs = parsePhoneWebhook(payload);
  if (pairs.length === 0) {
    // Log the raw shape so we can adjust the parser if Apollo's payload differs.
    console.warn("[apollo-phone-webhook] no phone found in payload", JSON.stringify(payload).slice(0, 1000));
    return NextResponse.json({ ok: true, updated: 0 });
  }

  const supabase = createAdminClient();
  let updated = 0;
  for (const { apolloPersonId, phone } of pairs) {
    const { data } = await supabase
      .from("leads")
      .update({ phone })
      .eq("apollo_person_id", apolloPersonId)
      .is("phone", null)
      .select("id");
    updated += (data ?? []).length;
  }

  return NextResponse.json({ ok: true, updated });
}
