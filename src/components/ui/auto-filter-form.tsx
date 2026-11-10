"use client";

import { cn } from "@/lib/utils";

/**
 * GET filter form that applies as soon as a <select> changes (text inputs
 * apply on Enter), so filter bars need no «Filtrer» button. Extra params
 * (view, tab…) are carried through as hidden inputs.
 */
export function AutoFilterForm({
  hidden = {},
  className,
  children,
}: {
  hidden?: Record<string, string | undefined>;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <form
      method="get"
      className={cn("flex flex-wrap items-center gap-2", className)}
      onChange={(e) => {
        if (e.target instanceof HTMLSelectElement) e.currentTarget.requestSubmit();
      }}
    >
      {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      {children}
    </form>
  );
}
