import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm border-2 border-ink font-pixel text-[10px] uppercase tracking-wide transition-all shadow-[3px_3px_0_0_var(--color-ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_var(--color-ink)] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
  {
    variants: {
      variant: {
        default: "bg-gold-500 text-ink hover:bg-gold-400",
        outline: "bg-parchment text-ink hover:bg-wood-100",
        ghost:
          "border-transparent shadow-none bg-transparent text-wood-800 hover:bg-wood-100 active:translate-x-0 active:translate-y-0",
        destructive: "bg-red-600 text-white hover:bg-red-500",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3",
        lg: "h-10 px-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
);
Button.displayName = "Button";
