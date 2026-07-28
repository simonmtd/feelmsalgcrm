import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// inline-block (not inline-flex) so `max-w-*` + `truncate` actually clip long labels
const badgeVariants = cva(
  "inline-block whitespace-nowrap align-middle rounded-sm border border-ink px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-4 tracking-wide shadow-[1px_1px_0_0_var(--color-ink)]",
  {
    variants: {
      variant: {
        default: "bg-wood-200 text-wood-900",
        blue: "bg-himmel-300 text-ink",
        amber: "bg-gold-400 text-ink",
        green: "bg-forest-400 text-ink",
        red: "bg-red-400 text-ink",
        purple: "bg-purple-300 text-ink",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
