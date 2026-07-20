"use client";

import { useTransition } from "react";
import { triggerDailyAssignment } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";

export function TriggerAssignmentButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await triggerDailyAssignment();
        })
      }
    >
      {isPending ? "Fordeler…" : "Fordel leads nå"}
    </Button>
  );
}
