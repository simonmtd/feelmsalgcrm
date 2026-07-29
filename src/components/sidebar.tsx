"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListChecks,
  CalendarDays,
  CalendarCheck,
  Handshake,
  Building2,
  Users,
  Tags,
  RefreshCw,
  Settings,
  BarChart3,
  ScrollText,
  LogOut,
  Clapperboard,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

const adminExtraLinks: NavLink[] = [
  { href: "/admin/leads", label: "Alle leads", icon: Building2 },
  { href: "/admin/stats", label: "Statistikk", icon: BarChart3 },
  { href: "/admin/sellers", label: "Selgere", icon: Users },
  { href: "/admin/niches", label: "Nicher", icon: Tags },
  { href: "/admin/sync", label: "Sync", icon: RefreshCw },
  { href: "/admin/audit", label: "Aktivitetslogg", icon: ScrollText },
  { href: "/admin/settings", label: "Innstillinger", icon: Settings },
];

export function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const isAdmin = profile.role === "admin";
  const links: NavLink[] = isAdmin
    ? [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/calendar", label: "Kalender", icon: CalendarDays },
        { href: "/meetings", label: "Møter", icon: Handshake },
        ...adminExtraLinks,
      ]
    : [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/today", label: "Dagens leads", icon: CalendarCheck },
        { href: "/leads", label: "Mine leads", icon: ListChecks },
        { href: "/meetings", label: "Mine møter", icon: Handshake },
        { href: "/calendar", label: "Kalender", icon: CalendarDays },
      ];

  return (
    <aside className="sticky top-3 flex h-[calc(100vh-6rem)] w-[76px] shrink-0 flex-col items-center gap-4 rounded-md border-2 border-ink bg-gradient-to-b from-wood-700 to-wood-900 py-5 shadow-[4px_4px_0_0_var(--color-ink)] sm:top-4">
      <Link
        href="/dashboard"
        title="Feelm Leads"
        className="flex h-11 w-11 items-center justify-center rounded-sm border-2 border-ink bg-gold-500 text-ink shadow-[2px_2px_0_0_var(--color-ink)] transition-colors hover:bg-gold-400"
      >
        <Clapperboard className="h-5 w-5" />
      </Link>

      <div className="h-0.5 w-8 shrink-0 bg-wood-500" />

      <nav className="flex flex-1 flex-col items-center gap-1.5">
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(link.href + "/");
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              title={link.label}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-sm border-2 border-transparent text-wood-200 transition-colors hover:bg-wood-600 hover:text-gold-100",
                active &&
                  "border-ink bg-gold-500 text-ink shadow-[2px_2px_0_0_var(--color-ink)] hover:bg-gold-500 hover:text-ink"
              )}
            >
              <Icon className="h-5 w-5" />
            </Link>
          );
        })}
      </nav>

      <form action={signOut}>
        <button
          type="submit"
          title="Logg ut"
          className="flex h-11 w-11 items-center justify-center rounded-sm text-wood-200 transition-colors hover:bg-red-900 hover:text-red-200"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </form>
    </aside>
  );
}
