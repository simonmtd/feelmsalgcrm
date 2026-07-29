"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { initialsFor } from "@/lib/avatar-color";
import { InfoPopover } from "@/components/ui/info-popover";
import { NotificationBell } from "@/components/notification-bell";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";
import type { Profile } from "@/lib/types";

interface TitleEntry {
  match: (path: string) => boolean;
  title: string;
  description?: string;
}

const TITLES: TitleEntry[] = [
  { match: (p) => p === "/dashboard", title: "Dashboard", description: "Oversikt over pipelinen din i dag" },
  { match: (p) => p === "/today", title: "Dagens leads", description: "Leadsene som er tildelt deg i dag, med kontaktinfo" },
  { match: (p) => p === "/notifications", title: "Varsler", description: "Beskjeder om nye leads og tildelinger" },
  { match: (p) => p === "/account", title: "Min konto", description: "Bytt passord" },
  { match: (p) => p === "/meetings", title: "Møter", description: "Registrer og følg opp bookede møter, med kunde, produkt og verdi" },
  { match: (p) => p === "/calendar", title: "Team-kalender", description: "Se salgsmøter og avtaler for hele teamet" },
  { match: (p) => p === "/leads" || p.startsWith("/leads/"), title: "Mine leads", description: "Alle leads som er eller har vært tildelt deg" },
  { match: (p) => p === "/admin/leads", title: "Alle leads", description: "Klassifiser niche, omfordel selgere, følg med på pipeline" },
  { match: (p) => p === "/admin/stats", title: "Statistikk", description: "Ytelse per selger — leads, vinnrate og verdi" },
  { match: (p) => p === "/admin/sellers", title: "Selgere", description: "Opprett og administrer brukere" },
  { match: (p) => p === "/admin/niches", title: "Nicher", description: "Bransjene selgerne velger mellom hver dag" },
  { match: (p) => p === "/admin/sync", title: "HubSpot-sync", description: "Historikk og manuell trigger av kontakt-import" },
  { match: (p) => p === "/admin/audit", title: "Aktivitetslogg", description: "Sporbar logg over admin-handlinger i systemet" },
  { match: (p) => p === "/admin/settings", title: "Innstillinger", description: "Styrer hvordan daglig lead-fordeling fungerer" },
];

function resolveTitle(pathname: string): TitleEntry {
  return TITLES.find((t) => t.match(pathname)) ?? { match: () => true, title: "Feelm Leads" };
}

export function PageHeader({ profile, unread = 0 }: { profile: Profile; unread?: number }) {
  const pathname = usePathname();
  const { title, description } = resolveTitle(pathname);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="inline-block rounded-sm border-2 border-ink bg-gradient-to-b from-wood-600 to-wood-800 px-4 py-2.5 font-pixel text-sm uppercase tracking-wider text-gold-100 shadow-[3px_3px_0_0_var(--color-ink)]">
          {title}
        </h1>
        {description && <p className="mt-2 text-sm text-wood-800">{description}</p>}
      </div>
      <div className="flex items-center gap-3">
      <NotificationBell unread={unread} />
      <InfoPopover
        title="Innlogget som"
        triggerLabel="Vis kontoinformasjon"
        trigger={
          <span className="flex items-center gap-3 rounded-sm border-2 border-ink bg-wood-900 py-1.5 pl-2 pr-4 shadow-[3px_3px_0_0_var(--color-ink)]">
            <span className="flex h-8 w-8 items-center justify-center rounded-sm border border-gold-500 bg-wood-700 text-xs font-semibold text-gold-100">
              {initialsFor(profile.full_name ?? profile.email)}
            </span>
            <span className="text-left leading-tight">
              <span className="block font-pixel text-[10px] uppercase tracking-wide text-gold-100">
                {profile.full_name ?? profile.email}
              </span>
              <span className="mt-0.5 block text-xs text-wood-200">
                {profile.role === "admin" ? "Admin" : "Selger"}
              </span>
            </span>
          </span>
        }
      >
        <p className="break-all font-mono">{profile.email}</p>
        <p>Rolle: {profile.role === "admin" ? "Admin" : "Selger"}</p>
        <p>Aktiv niche: {profile.active_niche?.name ?? "ingen valgt"}</p>
        <Link
          href="/account"
          className="mt-1 block rounded-sm border-2 border-ink bg-parchment px-3 py-1.5 text-center font-pixel text-[9px] uppercase tracking-wide text-ink shadow-[2px_2px_0_0_var(--color-ink)] transition-colors hover:bg-gold-100"
        >
          Bytt passord
        </Link>
        <form action={signOut} className="pt-1">
          <Button type="submit" variant="outline" size="sm" className="w-full">
            Logg ut
          </Button>
        </form>
      </InfoPopover>
      </div>
    </div>
  );
}
