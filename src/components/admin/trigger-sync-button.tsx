"use client";

import { useTransition } from "react";
import { triggerHubspotSync } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";

export function TriggerSyncButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await triggerHubspotSync();
        })
      }
    >
      {isPending ? "Synker…" : "Sync nå"}
    </Button>
  );
}
