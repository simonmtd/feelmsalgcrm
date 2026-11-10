"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Phone, CalendarClock } from "lucide-react";
import { updateLeadStatus } from "@/lib/actions/leads";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import type { Lead, LeadStatus } from "@/lib/types";

interface Column {
  key: string;
  label: string;
  /** Statuses shown in this column. */
  statuses: LeadStatus[];
  /** Status a lead gets when dropped here. */
  dropStatus: LeadStatus;
  dot: string;
}

// "Ny" and "Tildelt" both mean "not called yet" for a seller, so they share a column.
const COLUMNS: Column[] = [
  { key: "todo", label: "Ikke kontaktet", statuses: ["new", "assigned"], dropStatus: "assigned", dot: "bg-info" },
  { key: "contacted", label: "Kontaktet", statuses: ["contacted"], dropStatus: "contacted", dot: "bg-warning" },
  { key: "follow_up", label: "Følges opp", statuses: ["follow_up"], dropStatus: "follow_up", dot: "bg-[#d9873a]" },
  { key: "won", label: "Vunnet", statuses: ["won"], dropStatus: "won", dot: "bg-success" },
  { key: "lost", label: "Tapt", statuses: ["lost"], dropStatus: "lost", dot: "bg-danger" },
];

function followUpLabel(iso: string | null): { text: string; overdue: boolean } | null {
  if (!iso) return null;
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((new Date(d).setHours(0, 0, 0, 0) - today.getTime()) / 86_400_000);
  const text =
    days === 0 ? "I dag" : days === 1 ? "I morgen" : days === -1 ? "I går" : days < 0 ? `${-days} d siden` : `Om ${days} d`;
  return { text, overdue: days < 0 };
}

function BoardCard({ lead, onDragStart }: { lead: Lead; onDragStart: (id: string) => void }) {
  const fu = lead.status === "won" || lead.status === "lost" ? null : followUpLabel(lead.next_follow_up_at);
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", lead.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(lead.id);
      }}
      className="group cursor-grab rounded-lg border border-line bg-surface-2 p-3 transition-colors hover:border-line-strong active:cursor-grabbing"
    >
      <Link href={`/leads/${lead.id}`} className="block" draggable={false}>
        <p className="truncate text-sm font-medium text-fg group-hover:underline">
          {lead.company_name ?? "Ukjent firma"}
        </p>
        {lead.contact_name && <p className="truncate text-xs text-muted">{lead.contact_name}</p>}
      </Link>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {lead.niche && <Badge className="max-w-full truncate">{lead.niche.name}</Badge>}
        {lead.deal_size != null && (
          <span className="text-xs font-medium text-fg-2">{formatCurrency(lead.deal_size)}</span>
        )}
      </div>
      {(lead.phone || fu) && (
        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-line pt-2.5 text-xs">
          {lead.phone ? (
            <a
              href={`tel:${lead.phone.replace(/\s/g, "")}`}
              draggable={false}
              className="flex items-center gap-1.5 text-muted hover:text-brand"
            >
              <Phone className="h-3 w-3" /> {lead.phone}
            </a>
          ) : (
            <span />
          )}
          {fu && (
            <span className={cn("flex items-center gap-1", fu.overdue ? "text-danger" : "text-subtle")}>
              <CalendarClock className="h-3 w-3" /> {fu.text}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Kanban of a seller's leads by status. Drag a card to another column to change its status. */
export function LeadBoard({ leads }: { leads: Lead[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [optimistic, moveOptimistic] = useOptimistic(
    leads,
    (state, move: { id: string; status: LeadStatus }) =>
      state.map((l) => (l.id === move.id ? { ...l, status: move.status } : l))
  );

  function drop(col: Column, id: string) {
    setOverCol(null);
    setDragId(null);
    const lead = optimistic.find((l) => l.id === id);
    if (!lead || col.statuses.includes(lead.status)) return;
    setError(null);
    startTransition(async () => {
      moveOptimistic({ id, status: col.dropStatus });
      try {
        await updateLeadStatus(id, col.dropStatus);
        router.refresh();
      } catch {
        setError(`Kunne ikke flytte «${lead.company_name ?? "leadet"}». Prøv igjen.`);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {COLUMNS.map((col) => {
          const items = optimistic.filter((l) => col.statuses.includes(l.status));
          const value = items.reduce((s, l) => s + (l.deal_size ?? 0), 0);
          return (
            <section
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (overCol !== col.key) setOverCol(col.key);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                drop(col, e.dataTransfer.getData("text/plain") || dragId || "");
              }}
              className={cn(
                "flex w-72 shrink-0 flex-col rounded-xl border border-line bg-surface transition-colors lg:w-auto lg:min-w-0 lg:flex-1",
                overCol === col.key && "border-brand/60 bg-brand-soft"
              )}
            >
              <header className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
                <h3 className="flex items-center gap-2 text-sm font-medium text-fg">
                  <span className={cn("h-2 w-2 rounded-full", col.dot)} />
                  {col.label}
                  <span className="text-subtle">{items.length}</span>
                </h3>
                {value > 0 && <span className="text-xs text-subtle">{formatCurrency(value)}</span>}
              </header>
              <div className="flex min-h-32 flex-1 flex-col gap-2 p-2 pt-1">
                {items.map((lead) => (
                  <BoardCard key={lead.id} lead={lead} onDragStart={setDragId} />
                ))}
                {items.length === 0 && (
                  <p className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-line px-3 py-6 text-center text-xs text-subtle">
                    Dra et lead hit
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
