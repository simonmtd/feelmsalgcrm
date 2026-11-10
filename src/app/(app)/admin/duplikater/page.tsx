import { createAdminClient } from "@/lib/supabase/admin";
import { findDuplicateGroups } from "@/lib/duplicates";
import { DuplicateGroupCard } from "@/components/admin/duplicate-group-card";
import { Stat } from "@/components/ui/stat";
import { Card, CardContent } from "@/components/ui/card";

const SHOW = 50;

export default async function DuplicatesPage() {
  const admin = createAdminClient();
  const [groups, { data: sellers }] = await Promise.all([
    findDuplicateGroups(admin),
    admin.from("profiles").select("id, full_name, email"),
  ]);
  const sellerNames = Object.fromEntries(
    ((sellers as { id: string; full_name: string | null; email: string }[] | null) ?? []).map((s) => [s.id, (s.full_name ?? s.email).split(" ")[0]])
  );
  const extra = groups.reduce((s, g) => s + g.leads.length - 1, 0);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Stat label="Grupper med mulige duplikater" value={groups.length} />
        <Stat label="Leads som kan ryddes bort" value={extra} accent hint="Alle utenom den du beholder i hver gruppe" />
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted">Fant ingen duplikater. 🎉</CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Velg hvilket lead som skal beholdes (forhåndsvalgt: det som sist ble ringt, ellers det eldste). De andre markeres som
            duplikat og lukkes som «Tapt», og samtaler, notater og møter flyttes over. Tomme felt fylles inn fra duplikatene.
            {groups.length > SHOW && ` Viser de ${SHOW} største gruppene – last siden på nytt etter rydding for flere.`}
          </p>
          {groups.slice(0, SHOW).map((g) => (
            <DuplicateGroupCard key={g.leads.map((l) => l.id).join("-")} group={g} sellerNames={sellerNames} />
          ))}
        </div>
      )}
    </>
  );
}
