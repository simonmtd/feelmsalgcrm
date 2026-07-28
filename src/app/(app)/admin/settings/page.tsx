import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DailyLeadCountForm } from "@/components/admin/daily-lead-count-form";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data: setting } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "daily_lead_count")
    .maybeSingle();

  const dailyLeadCount = Number(setting?.value ?? 10);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Fordeling</CardTitle>
        </CardHeader>
        <CardContent>
          <DailyLeadCountForm initialValue={dailyLeadCount} />
        </CardContent>
      </Card>
    </>
  );
}
