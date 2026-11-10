import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// inline-block (not inline-flex) so `max-w-*` + `truncate` actually clip long labels
const badgeVariants = cva(
  "inline-block whitespace-nowrap rounded-full px-2 py-0.5 align-middle text-xs font-medium leading-5",
  {
    variants: {
      variant: {
        default: "bg-surface-3 text-fg-2",
        brand: "bg-brand-soft text-brand",
        blue: "bg-info-soft text-info",
        amber: "bg-warning-soft text-warning",
        green: "bg-success-soft text-success",
        red: "bg-danger-soft text-danger",
        purple: "bg-violet-soft text-violet",
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
