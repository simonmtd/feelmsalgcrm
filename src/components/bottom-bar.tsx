"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";

interface Shortcut {
  href: string;
  tag: string;
  tagClass: string;
  label: string;
}

const sellerShortcuts: Shortcut[] = [
  { href: "/today", tag: "DAG", tagClass: "bg-gold-500 text-ink", label: "Dagens leads" },
  { href: "/leads", tag: "MIN", tagClass: "bg-forest-500 text-white", label: "Mine leads" },
  { href: "/meetings", tag: "MØT", tagClass: "bg-purple-400 text-ink", label: "Mine møter" },
  { href: "/calendar", tag: "KAL", tagClass: "bg-himmel-500 text-ink", label: "Kalender" },
  { href: "/dashboard", tag: "DSH", tagClass: "bg-wood-200 text-wood-900", label: "Dashboard" },
];

const adminShortcuts: Shortcut[] = [
  { href: "/dashboard", tag: "DAG", tagClass: "bg-gold-500 text-ink", label: "Dashboard" },
  { href: "/leads", tag: "MIN", tagClass: "bg-gold-300 text-ink", label: "Mine leads" },
  { href: "/admin/leads", tag: "ALL", tagClass: "bg-forest-500 text-white", label: "Alle leads" },
  { href: "/meetings", tag: "MØT", tagClass: "bg-wood-200 text-wood-900", label: "Møter" },
  { href: "/calendar", tag: "KAL", tagClass: "bg-himmel-500 text-ink", label: "Kalender" },
  { href: "/admin/sync", tag: "SYN", tagClass: "bg-purple-400 text-ink", label: "Sync" },
  { href: "/admin/settings", tag: "INN", tagClass: "bg-red-400 text-ink", label: "Innstillinger" },
];

/** Fixed quick-access strip, styled like the toolbar at the bottom of the pixel-art reference. */
export function BottomBar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const shortcuts = profile.role === "admin" ? adminShortcuts : sellerShortcuts;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink bg-wood-900/95 px-3 py-2 backdrop-blur-sm">
      <div className="flex items-center gap-2 overflow-x-auto">
        {shortcuts.map((s) => {
          const active = pathname === s.href || pathname.startsWith(s.href + "/");
          return (
            <Link
              key={s.href}
              href={s.href}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-sm border-2 border-ink bg-wood-800 px-2 py-1.5 transition-colors hover:bg-wood-700",
                active && "bg-wood-700 ring-1 ring-gold-500"
              )}
            >
              <span
                className={cn(
                  "rounded-[2px] border border-ink px-1 py-0.5 font-pixel text-[10px]",
                  s.tagClass
                )}
              >
                {s.tag}
              </span>
              <span className="font-pixel text-[10px] uppercase tracking-wide text-wood-100">
                {s.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
