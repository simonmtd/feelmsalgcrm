import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runHubspotSync } from "@/lib/jobs/sync-hubspot";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runHubspotSync();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
