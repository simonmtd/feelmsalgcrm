"use client";

import { useTransition } from "react";
import { setSellerActive } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";

export function SellerActiveToggle({
  sellerId,
  isActive,
}: {
  sellerId: string;
  isActive: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() => startTransition(() => setSellerActive(sellerId, !isActive))}
    >
      {isActive ? "Deaktiver" : "Aktiver"}
    </Button>
  );
}
