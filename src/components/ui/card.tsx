import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-md border-2 border-ink bg-parchment shadow-[4px_4px_0_0_var(--color-ink)]",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col gap-1 p-5 sm:p-6", className)} {...props} />
  );
}

/** Wood-plank sign, like the nameplates in the pixel-art reference. */
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "inline-block w-fit rounded-sm border-2 border-ink bg-gradient-to-b from-wood-600 to-wood-800 px-3 py-2 font-pixel text-[10px] uppercase tracking-wider text-gold-100 shadow-[2px_2px_0_0_var(--color-ink)]",
        className
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-wood-700", className)} {...props} />
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-0 sm:p-6 sm:pt-0", className)} {...props} />;
}
