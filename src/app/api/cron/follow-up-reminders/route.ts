import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runFollowUpReminders } from "@/lib/jobs/follow-up-reminders";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runFollowUpReminders();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
