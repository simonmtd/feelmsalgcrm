"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Small pixel-styled popover used on icon badges that would otherwise look
 * clickable without doing anything. Closes on outside click and on Escape.
 */
export function InfoPopover({
  title,
  children,
  triggerLabel,
  triggerClassName,
  align = "right",
  trigger,
}: {
  title: string;
  children: React.ReactNode;
  triggerLabel: string;
  triggerClassName?: string;
  align?: "left" | "right";
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const panelId = React.useId();

  React.useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={triggerLabel}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "transition-transform active:translate-x-[1px] active:translate-y-[1px]",
          triggerClassName
        )}
      >
        {trigger}
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={title}
          className={cn(
            "absolute top-full z-30 mt-2 w-64 rounded-sm border-2 border-ink bg-parchment p-3 text-left shadow-[4px_4px_0_0_var(--color-ink)]",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          <p className="font-pixel text-[10px] uppercase leading-relaxed text-wood-900">
            {title}
          </p>
          <div className="mt-2 space-y-1.5 text-xs leading-relaxed text-wood-800">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
