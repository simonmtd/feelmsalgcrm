"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { autoClassifyNiches } from "@/lib/actions/lead-review";

/** Runs the niche auto-sort over every lead without a niche. */
export function AutoClassifyButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-muted">{msg}</span>}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        title="Setter nisje automatisk ut fra firmanavn, bransje og nettside – bare der det er tydelig. Resten blir stående for manuell sortering."
        onClick={() =>
          startTransition(async () => {
            const r = await autoClassifyNiches();
            setMsg(r.error ?? `${r.classified} av ${r.checked} fikk nisje`);
            router.refresh();
          })
        }
      >
        <Sparkles /> {isPending ? "Sorterer…" : "Auto-sorter nisje"}
      </Button>
    </div>
  );
}
