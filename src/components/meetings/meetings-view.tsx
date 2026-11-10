"use client";

import { useMemo, useState, useTransition, useActionState } from "react";
import { Plus, X, Trash2, CheckCircle2, Search } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  createMeeting,
  deleteMeeting,
  setMeetingSigned,
  type MeetingActionState,
} from "@/lib/actions/meetings";
import { LeadCombobox } from "@/components/meetings/lead-combobox";
import { CommissionCell } from "@/components/commission/commission-cell";
import { Textarea } from "@/components/ui/textarea";
import { Stat } from "@/components/ui/stat";
import { COMMISSION_PER_MEETING, commissionWeek } from "@/lib/commission";
import { segmented } from "@/components/ui/segmented";
import { avatarToneFor, initialsFor } from "@/lib/avatar-color";
import { formatCurrency, cn } from "@/lib/utils";
import { MEETING_TYPE_LABELS, PRODUCT_TYPE_LABELS } from "@/lib/types";
import type { Lead, Meeting, MeetingType, ProductType, Profile } from "@/lib/types";

const TYPE_DOT: Record<MeetingType, string> = {
  sales_meeting: "bg-brand",
  demo: "bg-info",
  follow_up: "bg-success",
  internal: "bg-subtle",
  other: "bg-violet",
};

const initialState: MeetingActionState = {};

function sellerLabel(m: Meeting) {
  return m.seller?.full_name ?? m.seller?.email ?? "Ukjent";
}

const TIME: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Oslo" };

function MeetingRow({
  meeting,
  canEdit,
  showSeller,
  onChanged,
}: {
  meeting: Meeting;
  canEdit: boolean;
  showSeller: boolean;
  onChanged: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [signing, setSigning] = useState(false);
  const [amount, setAmount] = useState("");
  const start = new Date(meeting.starts_at);
  const end = new Date(meeting.ends_at);
  const meta = [
    MEETING_TYPE_LABELS[meeting.type],
    meeting.product_type ? PRODUCT_TYPE_LABELS[meeting.product_type] : null,
    meeting.location,
  ].filter(Boolean);

  return (
    <tr className="group border-t border-line align-top transition-colors hover:bg-surface-2/50">
      {/* Calendar-style date block: the eye scans down the days. */}
      <td className="w-28 py-3 pl-1 pr-4">
        <div className="flex items-baseline gap-1.5">
          <span className="display text-[28px] text-fg">
            {start.toLocaleDateString("nb-NO", { day: "2-digit", timeZone: "Europe/Oslo" }).replace(".", "")}
          </span>
          <span className="eyebrow text-subtle">
            {start.toLocaleDateString("nb-NO", { weekday: "short", timeZone: "Europe/Oslo" }).replace(".", "")}
          </span>
        </div>
        <p className="mt-1 whitespace-nowrap text-xs text-subtle">
          {start.toLocaleTimeString("nb-NO", TIME)}–{end.toLocaleTimeString("nb-NO", TIME)}
        </p>
      </td>
      <td className="min-w-56 py-3 pr-4">
        <p className="font-medium text-fg">{meeting.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
          <span className={cn("h-1.5 w-1.5 rounded-full", TYPE_DOT[meeting.type])} />
          {meta.join(" · ")}
        </p>
        {meeting.notes && (
          <p className="mt-1 line-clamp-1 max-w-md text-xs italic text-subtle" title={meeting.notes}>
            {meeting.notes}
          </p>
        )}
      </td>
      <td className="py-3 pr-4">
        {meeting.lead ? (
          <Link href={`/leads/${meeting.lead.id}`} className="block text-sm text-fg-2 hover:text-fg hover:underline">
            {meeting.lead.company_name ?? "Ukjent firma"}
            {meeting.lead.contact_name && <span className="block text-xs text-subtle">{meeting.lead.contact_name}</span>}
          </Link>
        ) : (
          <span className="text-sm text-subtle">–</span>
        )}
      </td>
      {showSeller && (
        <td className="py-3 pr-4">
          <span className="flex items-center gap-2 text-sm text-fg-2" title={sellerLabel(meeting)}>
            <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold", avatarToneFor(meeting.seller_id))}>
              {initialsFor(sellerLabel(meeting))}
            </span>
            <span className="hidden truncate xl:inline">{sellerLabel(meeting).split(" ")[0]}</span>
          </span>
        </td>
      )}
      <td className="py-3 pr-4 text-right text-sm font-medium text-fg">
        {meeting.deal_size != null ? formatCurrency(meeting.deal_size) : <span className="text-subtle">–</span>}
      </td>
      <td className="py-3 pr-4">
        {meeting.signed ? (
          <button
            type="button"
            disabled={isPending || !canEdit}
            onClick={() =>
              startTransition(async () => {
                await setMeetingSigned(meeting.id, false);
                onChanged();
              })
            }
            title={canEdit ? "Klikk for å angre signert" : "Signert"}
            className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success disabled:cursor-default"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Signert
          </button>
        ) : canEdit ? (
          signing ? (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={0}
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Beløp"
                className="h-8 w-24 text-xs"
              />
              <Button
                type="button"
                size="sm"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await setMeetingSigned(meeting.id, true, amount.trim() ? Number(amount) : null);
                    setSigning(false);
                    onChanged();
                  })
                }
              >
                Signer
              </Button>
              <button type="button" onClick={() => setSigning(false)} className="px-1 text-xs text-subtle hover:text-fg">
                Avbryt
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setAmount(meeting.deal_size != null ? String(meeting.deal_size) : "");
                setSigning(true);
              }}
              className="whitespace-nowrap text-xs text-subtle transition-colors hover:text-success group-hover:text-muted"
            >
              Marker signert
            </button>
          )
        ) : (
          <span className="text-sm text-subtle">–</span>
        )}
      </td>
      <td className="py-3 pr-2">
        <CommissionCell meeting={meeting} canEdit={canEdit} />
      </td>
      <td className="w-8 py-3">
        {canEdit && (
          <button
            type="button"
            aria-label={`Slett møtet ${meeting.title}`}
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await deleteMeeting(meeting.id);
                onChanged();
              })
            }
            className="rounded-md p-1 text-subtle opacity-0 transition hover:bg-danger-soft hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </td>
    </tr>
  );
}

/** Meetings grouped by week, each week with its own summary line. */
function MeetingTable({
  meetings,
  profile,
  showSeller,
  onChanged,
}: {
  meetings: Meeting[];
  profile: Profile;
  showSeller: boolean;
  onChanged: () => void;
}) {
  const weeks = useMemo(() => {
    const map = new Map<string, { label: string; items: Meeting[] }>();
    for (const m of meetings) {
      const w = commissionWeek(m.starts_at);
      if (!map.has(w.key)) map.set(w.key, { label: w.label, items: [] });
      map.get(w.key)!.items.push(m);
    }
    return [...map.values()];
  }, [meetings]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        {weeks.map((w) => {
          const signed = w.items.filter((m) => m.signed);
          const signedValue = signed.reduce((s, m) => s + (m.deal_size ?? 0), 0);
          return (
            <tbody key={w.label}>
              <tr>
                <td colSpan={showSeller ? 8 : 7} className="pb-2 pt-6 first:pt-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-fg">{w.label}</p>
                    <p className="text-xs text-subtle">
                      {w.items.length} {w.items.length === 1 ? "møte" : "møter"}
                      {signed.length > 0 && (
                        <>
                          {" · "}
                          <span className="text-success">
                            {signed.length} signert · {formatCurrency(signedValue)}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </td>
              </tr>
              {w.items.map((meeting) => (
                <MeetingRow
                  key={meeting.id}
                  meeting={meeting}
                  showSeller={showSeller}
                  canEdit={profile.role === "admin" || meeting.seller_id === profile.id}
                  onChanged={onChanged}
                />
              ))}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}

export function MeetingsView({
  profile,
  meetings,
  leads,
  team,
}: {
  profile: Profile;
  meetings: Meeting[];
  leads: Pick<Lead, "id" | "company_name" | "contact_name">[];
  team: Pick<Profile, "id" | "full_name" | "email">[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [productFilter, setProductFilter] = useState("");
  const [signedFilter, setSignedFilter] = useState<"all" | "signed" | "unsigned">("all");
  const [sellerFilter, setSellerFilter] = useState("");
  const [search, setSearch] = useState("");
  const [pastWeeks, setPastWeeks] = useState(4);
  const isAdmin = profile.role === "admin";
  const [defaultDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [state, formAction] = useActionState(createMeeting, initialState);
  const [, startTransition] = useTransition();
  // Captured once so the upcoming/past split stays stable across re-renders.
  const [now] = useState(() => Date.now());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return meetings.filter(
      (m) =>
        (!productFilter || m.product_type === productFilter) &&
        (!sellerFilter || m.seller_id === sellerFilter) &&
        (signedFilter === "all" || (signedFilter === "signed") === m.signed) &&
        (!q ||
          [m.title, m.notes, m.location, m.lead?.company_name, m.lead?.contact_name]
            .filter(Boolean)
            .some((f) => f!.toLowerCase().includes(q)))
    );
  }, [meetings, productFilter, sellerFilter, signedFilter, search]);

  const upcoming = useMemo(
    () =>
      filtered
        .filter((m) => new Date(m.starts_at).getTime() >= now)
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    [filtered, now]
  );
  const past = useMemo(
    () =>
      filtered
        .filter((m) => new Date(m.starts_at).getTime() < now)
        .sort((a, b) => b.starts_at.localeCompare(a.starts_at)),
    [filtered, now]
  );

  // Only the latest N weeks of past meetings; «Vis eldre» adds more.
  const pastWeekKeys = useMemo(() => [...new Set(past.map((m) => commissionWeek(m.starts_at).key))], [past]);
  const visiblePast = useMemo(() => {
    const keep = new Set(pastWeekKeys.slice(0, pastWeeks));
    return past.filter((m) => keep.has(commissionWeek(m.starts_at).key));
  }, [past, pastWeekKeys, pastWeeks]);

  const pipelineValue = upcoming.reduce((sum, m) => sum + (m.deal_size ?? 0), 0);
  const totalValue = filtered.reduce((sum, m) => sum + (m.deal_size ?? 0), 0);

  const byProduct = useMemo(() => {
    const counts = new Map<ProductType, { count: number; value: number }>();
    for (const m of filtered) {
      if (!m.product_type) continue;
      const entry = counts.get(m.product_type) ?? { count: 0, value: 0 };
      entry.count += 1;
      entry.value += m.deal_size ?? 0;
      counts.set(m.product_type, entry);
    }
    return [...counts.entries()].sort((a, b) => b[1].value - a[1].value);
  }, [filtered]);

  function refresh() {
    startTransition(() => {});
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Kommende møter" value={upcoming.length} />
        <Stat
          label="Verdi i pipeline"
          value={formatCurrency(pipelineValue)}
          hint="Sum deal size på kommende møter"
          accent
        />
        <Stat
          label="Registrert totalt"
          value={formatCurrency(totalValue)}
          hint={`${filtered.length} ${filtered.length === 1 ? "møte" : "møter"}`}
        />
      </div>

      {byProduct.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Fordelt på produkt</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {byProduct.map(([product, { count, value }]) => (
              <span
                key={product}
                className="rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-xs text-fg "
              >
                <span className="font-semibold">{PRODUCT_TYPE_LABELS[product]}</span>
                <span className="ml-2">
                  {count} · {formatCurrency(value)}
                </span>
              </span>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <Input
            aria-label="Søk i møter"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søk møte eller kunde…"
            className="pl-9"
          />
        </div>
        <div className={segmented.root}>
          {(
            [
              ["all", "Alle"],
              ["unsigned", "Ikke signert"],
              ["signed", "Signert"],
            ] as const
          ).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setSignedFilter(key)} className={segmented.item(signedFilter === key)}>
              {label}
            </button>
          ))}
        </div>
        {isAdmin && (
          <Select aria-label="Filtrer på selger" value={sellerFilter} onChange={(e) => setSellerFilter(e.target.value)} className="w-auto">
            <option value="">Alle selgere</option>
            {team.map((member) => (
              <option key={member.id} value={member.id}>
                {member.full_name ?? member.email}
              </option>
            ))}
          </Select>
        )}
        <Select aria-label="Filtrer på produkt" value={productFilter} onChange={(e) => setProductFilter(e.target.value)} className="w-auto">
          <option value="">Alle produkter</option>
          {Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Button type="button" className="ml-auto" onClick={() => setShowForm((v) => !v)}>
          {showForm ? <X /> : <Plus />}
          Registrer møte
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Nytt møte</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={formAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-1.5 lg:col-span-2">
                <Label htmlFor="title">Tittel</Label>
                <Input id="title" name="title" required placeholder="F.eks. Salgsmøte: Nordvik Bygg AS" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Kunde</Label>
                <LeadCombobox leads={leads} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="type">Møtetype</Label>
                <Select id="type" name="type" defaultValue="sales_meeting">
                  {Object.entries(MEETING_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="product_type">Hva skal selges</Label>
                <Select id="product_type" name="product_type" defaultValue="">
                  <option value="">Ikke bestemt</option>
                  {Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="deal_size">Deal size (NOK)</Label>
                <Input id="deal_size" name="deal_size" type="number" min={0} placeholder="45000" />
              </div>
              {profile.role === "admin" && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="seller_id">Selger</Label>
                  <Select id="seller_id" name="seller_id" defaultValue={profile.id}>
                    {team.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.full_name ?? member.email}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="date">Dato</Label>
                <Input id="date" name="date" type="date" defaultValue={defaultDate} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="start_time">Start</Label>
                <Input id="start_time" name="start_time" type="time" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="end_time">Slutt</Label>
                <Input id="end_time" name="end_time" type="time" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="location">Sted</Label>
                <Input id="location" name="location" placeholder="Teams, kontoret, hos kunden…" />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-4">
                <Label htmlFor="notes">Notat</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder="Hvem møtte du, hva ble sagt, neste steg … (påkrevd for provisjon)"
                />
              </div>
              <label className="flex w-fit items-center gap-2 text-sm text-fg-2 sm:col-span-2 lg:col-span-4">
                <input type="checkbox" name="commission_claimed" className="h-4 w-4 accent-brand" />
                Provisjonsmøte – krev {formatCurrency(COMMISSION_PER_MEETING)} (godkjennes i ukesrapporten)
              </label>

              <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4">
                <Button type="submit">Lagre møte</Button>
                {state?.error && <p className="text-sm text-danger">{state.error}</p>}
                {state?.success && <p className="text-sm text-success">{state.success}</p>}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Kommende <span className="font-normal text-subtle">{upcoming.length}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length ? (
            <MeetingTable meetings={upcoming} profile={profile} showSeller={isAdmin} onChanged={refresh} />
          ) : (
            <p className="py-6 text-center text-sm text-muted">Ingen kommende møter{search || sellerFilter || productFilter || signedFilter !== "all" ? " som matcher filteret" : " registrert"}.</p>
          )}
        </CardContent>
      </Card>

      {past.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Gjennomførte <span className="font-normal text-subtle">{past.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MeetingTable meetings={visiblePast} profile={profile} showSeller={isAdmin} onChanged={refresh} />
            {pastWeekKeys.length > pastWeeks && (
              <div className="mt-5 flex justify-center">
                <Button type="button" variant="outline" size="sm" onClick={() => setPastWeeks((n) => n + 4)}>
                  Vis eldre ({pastWeekKeys.length - pastWeeks} uker til)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
