import { requireProfile } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadApiSellers } from "@/lib/api-keys";
import { grokInstructions } from "@/lib/grok-prompt";
import { GrokInstructionsCard, GrokPastePanel } from "@/components/grok/grok-import-panel";

export default async function GrokPage() {
  const profile = await requireProfile();
  const isAdmin = profile.role === "admin";

  const sellers = await loadApiSellers(createAdminClient());
  const handles = [...sellers.keys()].sort();
  const ownHandle = [...sellers.values()].find((s) => s.id === profile.id)?.handle ?? null;

  return (
    <div className="flex flex-col gap-6">
      <GrokInstructionsCard instructions={grokInstructions(handles, isAdmin ? null : ownHandle)} />
      <GrokPastePanel isAdmin={isAdmin} />
    </div>
  );
}
