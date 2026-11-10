"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navSections, isActive } from "@/components/nav-links";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";

/** Mobile tab bar (below lg): the same links as the sidebar, icon + short label, scrollable. */
export function BottomBar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const links = navSections(profile).flatMap((s) => s.links);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      <div className="flex gap-1 overflow-x-auto px-2 py-1.5">
        {links.map((link) => {
          const active = isActive(pathname, link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex min-w-[68px] shrink-0 flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] text-subtle transition-colors",
                active ? "bg-surface-2 text-fg" : "hover:text-fg"
              )}
            >
              <Icon className={cn("h-[18px] w-[18px]", active && "text-brand")} />
              <span className="whitespace-nowrap">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
