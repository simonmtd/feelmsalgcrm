"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { initialsFor } from "@/lib/avatar-color";
import { InfoPopover } from "@/components/ui/info-popover";
import { NotificationBell } from "@/components/notification-bell";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";
import { Wordmark } from "@/components/sidebar";
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
  { match: (p) => p === "/provisjon", title: "Min provisjon", description: "500 kr per kvalifiserte møte – godkjennes hver fredag" },
  { match: (p) => p === "/admin/provisjon", title: "Provisjon", description: "Kryss Ja/Nei på ukens provisjonsmøter og se oppgjør per selger" },
  { match: (p) => p === "/grok", title: "Grok-import", description: "Hent leads med Grok og legg dem rett inn i CRM-et" },
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
  const name = profile.full_name ?? profile.email;

  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <Wordmark className="mb-3 block text-2xl lg:hidden" />
        <h1 className="display text-[40px] text-fg sm:text-5xl">{title}</h1>
        {description && <p className="mt-2 text-sm text-muted">{description}</p>}
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell unread={unread} />
        {/* The sidebar carries the user on desktop; on mobile it lives here. */}
        <div className="lg:hidden">
          <InfoPopover
            title="Innlogget som"
            triggerLabel="Vis kontoinformasjon"
            align="right"
            trigger={
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
                {initialsFor(name)}
              </span>
            }
          >
            <p className="font-medium text-fg">{name}</p>
            <p className="break-all font-mono">{profile.email}</p>
            <p>Rolle: {profile.role === "admin" ? "Admin" : "Selger"}</p>
            <p>Aktiv niche: {profile.active_niche?.name ?? "ingen valgt"}</p>
            <Link href="/account" className="block pt-1 text-brand hover:underline">
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
    </header>
  );
}
