import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TriggerSyncButton } from "@/components/admin/trigger-sync-button";
import { formatDateTime } from "@/lib/utils";
import type { SyncRun } from "@/lib/types";

const STATUS_VARIANT: Record<SyncRun["status"], "amber" | "green" | "red"> = {
  running: "amber",
  success: "green",
  error: "red",
};

export default async function AdminSyncPage() {
  const supabase = await createClient();
  const { data: runs } = await supabase
    .from("sync_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(25);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">HubSpot-sync</h1>
          <p className="text-sm text-neutral-500">
            Henter kontakter fra HubSpot inn i leads-databasen. Kjører automatisk
            via cron, kan også trigges manuelt.
          </p>
        </div>
        <TriggerSyncButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historikk</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase text-neutral-500">
                <th className="py-2 pr-4">Startet</th>
                <th className="py-2 pr-4">Fullført</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Antall synket</th>
                <th className="py-2 pr-4">Feil</th>
              </tr>
            </thead>
            <tbody>
              {(runs as SyncRun[] | null)?.map((run) => (
                <tr key={run.id} className="border-b border-neutral-100">
                  <td className="py-2 pr-4">{formatDateTime(run.started_at)}</td>
                  <td className="py-2 pr-4">{formatDateTime(run.finished_at)}</td>
                  <td className="py-2 pr-4">
                    <Badge variant={STATUS_VARIANT[run.status]}>{run.status}</Badge>
                  </td>
                  <td className="py-2 pr-4">{run.records_synced}</td>
                  <td className="py-2 pr-4 text-red-600">{run.error ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!runs?.length && (
            <p className="py-6 text-center text-sm text-neutral-500">
              Ingen sync-jobber kjørt ennå.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
