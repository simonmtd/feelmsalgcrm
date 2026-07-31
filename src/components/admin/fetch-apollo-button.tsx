"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { fetchApolloLeads } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";

/** Admin button: pull a batch of fresh ICP-matched prospects from Apollo. */
export function FetchApolloButton({ count = 25 }: { count?: number }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setMsg(null);
            const res = await fetchApolloLeads(count);
            setMsg(res.message);
          })
        }
      >
        <Download className="h-3.5 w-3.5" />
        {isPending ? "Henter…" : "Hent nye leads"}
      </Button>
      {msg && <span className="text-xs text-forest-700">{msg}</span>}
    </div>
  );
}
