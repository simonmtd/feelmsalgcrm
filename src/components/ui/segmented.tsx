import { cn } from "@/lib/utils";

/** Class names for a segmented control ("Uke / Måned / År"), shared so every toggle looks the same. */
export const segmented = {
  root: "inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-line bg-bg p-0.5",
  item: (active: boolean) =>
    cn(
      "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors [&_svg]:h-3.5 [&_svg]:w-3.5",
      active ? "bg-surface-3 text-fg shadow-sm shadow-black/40" : "text-muted hover:text-fg"
    ),
};
