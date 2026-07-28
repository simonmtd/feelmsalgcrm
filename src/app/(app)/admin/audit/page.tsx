import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { AUDIT_ACTION_LABELS } from "@/lib/types";
import type { AuditLogEntry } from "@/lib/types";

function describeDetails(entry: AuditLogEntry): string {
  const d = entry.details;
  if (!d) return "–";
  const parts: string[] = [];
  if (typeof d.email === "string") parts.push(d.email);
  if (typeof d.name === "string") parts.push(d.name);
  if (typeof d.role === "string") parts.push(`rolle: ${d.role}`);
  if (typeof d.count === "number") parts.push(`${d.count} leads`);
  if (typeof d.assigned === "number") parts.push(`${d.assigned} tildelt`);
  if (typeof d.value === "number") parts.push(`verdi: ${d.value}`);
  if (typeof d.recordsSynced === "number") parts.push(`${d.recordsSynced} synket`);
  return parts.length ? parts.join(" · ") : "–";
}

export default async function AdminAuditPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const entries = (data as AuditLogEntry[] | null) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aktivitetslogg</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/25 text-left text-xs uppercase text-wood-700">
              <th className="py-2 pr-4">Tidspunkt</th>
              <th className="py-2 pr-4">Bruker</th>
              <th className="py-2 pr-4">Handling</th>
              <th className="py-2 pr-4">Detaljer</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b border-ink/15">
                <td className="whitespace-nowrap py-2 pr-4 font-mono text-xs text-wood-700">
                  {formatDateTime(entry.created_at)}
                </td>
                <td className="py-2 pr-4">{entry.actor_email}</td>
                <td className="py-2 pr-4">
                  <Badge variant="blue">
                    {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                  </Badge>
                </td>
                <td className="py-2 pr-4 text-wood-800">{describeDetails(entry)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!entries.length && (
          <p className="py-6 text-center text-sm text-wood-700">Ingen aktivitet logget ennå.</p>
        )}
      </CardContent>
    </Card>
  );
}
