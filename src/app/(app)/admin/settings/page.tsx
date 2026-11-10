import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DailyLeadCountForm } from "@/components/admin/daily-lead-count-form";
import { ApiKeysCard } from "@/components/admin/api-keys-card";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ApiKeyRow } from "@/lib/actions/api-keys";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data: setting } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "daily_lead_count")
    .maybeSingle();

  const dailyLeadCount = Number(setting?.value ?? 10);

  // api_keys is service-role only (no RLS policies); this page is admin-gated by the layout.
  const admin = createAdminClient();
  const [{ data: keys }, { data: sellers }] = await Promise.all([
    admin.from("api_keys").select("id, name, seller_id, created_at, last_used_at, revoked_at").order("created_at", { ascending: false }),
    admin.from("profiles").select("id, full_name, email, handle").eq("is_active", true).order("full_name"),
  ]);

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

      <ApiKeysCard
        keys={(keys as ApiKeyRow[] | null) ?? []}
        sellers={(sellers as { id: string; full_name: string | null; email: string; handle: string | null }[] | null) ?? []}
      />
    </>
  );
}
