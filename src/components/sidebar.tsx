"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { initialsFor } from "@/lib/avatar-color";
import { navSections, isActive } from "@/components/nav-links";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";

/** Feelm wordmark: the brush font in brand pink, like feelm.no. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-brush text-[28px] leading-none text-brand", className)}>
      feelm
    </span>
  );
}

/** Desktop sidebar (lg+): labelled sections, user + sign-out at the bottom. */
export function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const name = profile.full_name ?? profile.email;

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-bg lg:flex">
      <Link href="/dashboard" className="flex items-baseline gap-2 px-5 pb-6 pt-6">
        <Wordmark />
        <span className="eyebrow text-subtle">Leads</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3">
        {navSections(profile).map((section) => (
          <div key={section.title} className="flex flex-col gap-0.5">
            <p className="eyebrow px-2 pb-1.5 text-subtle">{section.title}</p>
            {section.links.map((link) => {
              const active = isActive(pathname, link.href);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded-lg px-2 py-[7px] text-sm text-muted transition-colors hover:bg-surface hover:text-fg",
                    active && "bg-surface-2 font-medium text-fg hover:bg-surface-2"
                  )}
                >
                  {active && <span className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand" />}
                  <Icon className={cn("h-4 w-4 shrink-0", active ? "text-brand" : "text-subtle group-hover:text-muted")} />
                  {link.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-2.5 border-t border-line p-3">
        <Link
          href="/account"
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-surface"
          title="Min konto"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
            {initialsFor(name)}
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-medium text-fg">{name}</span>
            <span className="block text-xs text-subtle">{profile.role === "admin" ? "Admin" : "Selger"}</span>
          </span>
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            title="Logg ut"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle transition-colors hover:bg-danger-soft hover:text-danger"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      </div>
    </aside>
  );
}
