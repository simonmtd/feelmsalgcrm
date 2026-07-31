import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runApolloLeadFetch } from "@/lib/jobs/fetch-apollo-leads";

export const maxDuration = 60;

/** Daily default: how many fresh Apollo prospects to import each morning. */
const DAILY_COUNT = Number(process.env.APOLLO_DAILY_FETCH ?? 25);

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runApolloLeadFetch(DAILY_COUNT);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
