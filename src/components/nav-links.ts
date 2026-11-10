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
  Bot,
  Coins,
  type LucideIcon,
} from "lucide-react";
import type { Profile } from "@/lib/types";

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavSection {
  title: string;
  links: NavLink[];
}

/** Navigation for a profile, grouped into sections. Used by the sidebar (desktop) and tab bar (mobile). */
export function navSections(profile: Pick<Profile, "role">): NavSection[] {
  if (profile.role === "admin") {
    return [
      {
        title: "Salg",
        links: [
          { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
          { href: "/leads", label: "Mine leads", icon: ListChecks },
          { href: "/meetings", label: "Møter", icon: Handshake },
          { href: "/calendar", label: "Kalender", icon: CalendarDays },
          { href: "/grok", label: "Grok-import", icon: Bot },
        ],
      },
      {
        title: "Admin",
        links: [
          { href: "/admin/leads", label: "Alle leads", icon: Building2 },
          { href: "/admin/provisjon", label: "Provisjon", icon: Coins },
          { href: "/admin/stats", label: "Statistikk", icon: BarChart3 },
          { href: "/admin/sellers", label: "Selgere", icon: Users },
          { href: "/admin/niches", label: "Nicher", icon: Tags },
          { href: "/admin/sync", label: "Sync", icon: RefreshCw },
          { href: "/admin/audit", label: "Aktivitetslogg", icon: ScrollText },
          { href: "/admin/settings", label: "Innstillinger", icon: Settings },
        ],
      },
    ];
  }
  return [
    {
      title: "Salg",
      links: [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/today", label: "Dagens leads", icon: CalendarCheck },
        { href: "/leads", label: "Mine leads", icon: ListChecks },
        { href: "/meetings", label: "Mine møter", icon: Handshake },
        { href: "/provisjon", label: "Min provisjon", icon: Coins },
      ],
    },
    {
      title: "Verktøy",
      links: [
        { href: "/calendar", label: "Kalender", icon: CalendarDays },
        { href: "/grok", label: "Grok-import", icon: Bot },
      ],
    },
  ];
}

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}
