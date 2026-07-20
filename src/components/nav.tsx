"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";

const sellerLinks = [
  { href: "/dashboard", label: "I dag" },
  { href: "/leads", label: "Mine leads" },
];

const adminLinks = [
  { href: "/admin/leads", label: "Alle leads" },
  { href: "/admin/sellers", label: "Selgere" },
  { href: "/admin/niches", label: "Nicher" },
  { href: "/admin/sync", label: "Sync" },
  { href: "/admin/settings", label: "Innstillinger" },
];

export function Nav({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const links = profile.role === "admin" ? [...sellerLinks, ...adminLinks] : sellerLinks;

  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-base font-semibold text-neutral-900">
            Feelm Leads
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
            {links.map((link) => {
              const active =
                pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
                    active && "bg-neutral-900 text-white hover:bg-neutral-900 hover:text-white"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-500">
            {profile.full_name ?? profile.email}
          </span>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              Logg ut
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
