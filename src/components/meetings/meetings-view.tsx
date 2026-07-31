"use client";

import { useMemo, useState, useTransition, useActionState } from "react";
import { Plus, X, MapPin, Trash2, Building2, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { formatCurrency, cn } from "@/lib/utils";
import { MEETING_TYPE_LABELS, PRODUCT_TYPE_LABELS } from "@/lib/types";
import type { Lead, Meeting, MeetingType, ProductType, Profile } from "@/lib/types";

const MEETING_TYPE_VARIANT: Record<MeetingType, "amber" | "blue" | "green" | "default" | "purple"> = {
  sales_meeting: "amber",
  demo: "blue",
  follow_up: "green",
  internal: "default",
  other: "purple",
};

const initialState: MeetingActionState = {};

function formatWhen(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const date = start.toLocaleDateString("nb-NO", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  const opts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  return `${date} · ${start.toLocaleTimeString("nb-NO", opts)}–${end.toLocaleTimeString("nb-NO", opts)}`;
}

function MeetingRow({
  meeting,
  canEdit,
  onChanged,
}: {
  meeting: Meeting;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <tr className="border-b border-ink/15 align-top">
      <td className="py-3 pr-4">
        <p className="font-medium text-ink">{meeting.title}</p>
        <p className="mt-0.5 font-mono text-xs text-wood-700">
          {formatWhen(meeting.starts_at, meeting.ends_at)}
        </p>
        {meeting.location && (
          <p className="mt-1 flex items-center gap-1 text-xs text-wood-600">
            <MapPin className="h-3 w-3" /> {meeting.location}
          </p>
        )}
      </td>
      <td className="py-3 pr-4">
        {meeting.lead ? (
          <Link
            href={`/leads/${meeting.lead.id}`}
            className="flex items-start gap-1.5 text-sm text-ink hover:underline"
          >
            <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-wood-600" />
            <span>
              {meeting.lead.company_name ?? "Ukjent firma"}
              {meeting.lead.contact_name && (
                <span className="block text-xs text-wood-700">{meeting.lead.contact_name}</span>
              )}
            </span>
          </Link>
        ) : (
          <span className="text-sm text-wood-600">–</span>
        )}
      </td>
      <td className="py-3 pr-4">
        <Badge variant={MEETING_TYPE_VARIANT[meeting.type]}>
          {MEETING_TYPE_LABELS[meeting.type]}
        </Badge>
      </td>
      <td className="py-3 pr-4">
        {meeting.product_type ? (
          <span className="text-sm text-ink">{PRODUCT_TYPE_LABELS[meeting.product_type]}</span>
        ) : (
          <span className="text-sm text-wood-600">–</span>
        )}
      </td>
      <td className="py-3 pr-4 font-mono text-sm font-bold text-ink">
        {formatCurrency(meeting.deal_size)}
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
            className="inline-flex items-center gap-1 rounded-sm border-2 border-ink bg-forest-500 px-2 py-1 text-xs font-bold text-parchment shadow-[2px_2px_0_0_var(--color-ink)] disabled:opacity-70"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Signert
          </button>
        ) : canEdit ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await setMeetingSigned(meeting.id, true);
                onChanged();
              })
            }
            className="inline-flex items-center gap-1 rounded-sm border-2 border-ink bg-wood-100 px-2 py-1 text-xs text-wood-800 transition-colors hover:bg-gold-300 disabled:opacity-50"
          >
            Marker signert
          </button>
        ) : (
          <span className="text-sm text-wood-600">–</span>
        )}
      </td>
      <td className="py-3">
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
            className="rounded-sm border-2 border-transparent p-1 text-wood-600 transition-colors hover:border-ink hover:bg-red-400 hover:text-ink disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </td>
    </tr>
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
  const [defaultDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [state, formAction] = useActionState(createMeeting, initialState);
  const [, startTransition] = useTransition();
  // Captured once so the upcoming/past split stays stable across re-renders.
  const [now] = useState(() => Date.now());

  const filtered = useMemo(
    () =>
      productFilter
        ? meetings.filter((m) => m.product_type === productFilter)
        : meetings,
    [meetings, productFilter]
  );

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
        <Card>
          <CardContent className="pt-5">
            <p className="font-pixel text-[10px] uppercase leading-relaxed text-wood-800">
              Kommende møter
            </p>
            <p className="mt-2 font-mono text-2xl font-bold text-ink">{upcoming.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="font-pixel text-[10px] uppercase leading-relaxed text-wood-800">
              Verdi i pipeline
            </p>
            <p className="mt-2 font-mono text-2xl font-bold text-ink">
              {formatCurrency(pipelineValue)}
            </p>
            <p className="mt-1 text-xs text-wood-700">Sum deal size på kommende møter</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="font-pixel text-[10px] uppercase leading-relaxed text-wood-800">
              Registrert totalt
            </p>
            <p className="mt-2 font-mono text-2xl font-bold text-ink">
              {formatCurrency(totalValue)}
            </p>
            <p className="mt-1 text-xs text-wood-700">
              {filtered.length} {filtered.length === 1 ? "møte" : "møter"}
            </p>
          </CardContent>
        </Card>
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
                className="rounded-sm border-2 border-ink bg-wood-100 px-2.5 py-1.5 text-xs text-wood-900 shadow-[2px_2px_0_0_var(--color-ink)]"
              >
                <span className="font-semibold">{PRODUCT_TYPE_LABELS[product]}</span>
                <span className="ml-2 font-mono">
                  {count} · {formatCurrency(value)}
                </span>
              </span>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-wood-800">Produkt:</span>
          <Select
            aria-label="Filtrer på produkt"
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="w-52"
          >
            <option value="">Alle</option>
            {Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <Button type="button" size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
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
                <Label htmlFor="lead_id">Kunde</Label>
                <Select id="lead_id" name="lead_id" defaultValue="">
                  <option value="">Ingen kunde valgt</option>
                  {leads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.company_name ?? "Ukjent firma"}
                    </option>
                  ))}
                </Select>
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

              <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4">
                <Button type="submit">Lagre møte</Button>
                {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
                {state?.success && <p className="text-sm text-forest-700">{state.success}</p>}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Kommende ({upcoming.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {upcoming.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/25 text-left text-xs uppercase text-wood-700">
                  <th className="py-2 pr-4">Møte</th>
                  <th className="py-2 pr-4">Kunde</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Produkt</th>
                  <th className="py-2 pr-4">Deal size</th>
                  <th className="py-2 pr-4">Signert</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {upcoming.map((meeting) => (
                  <MeetingRow
                    key={meeting.id}
                    meeting={meeting}
                    canEdit={profile.role === "admin" || meeting.seller_id === profile.id}
                    onChanged={refresh}
                  />
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-6 text-center text-sm text-wood-700">
              Ingen kommende møter registrert.
            </p>
          )}
        </CardContent>
      </Card>

      {past.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Gjennomførte ({past.length})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className={cn("w-full text-sm", "opacity-80")}>
              <thead>
                <tr className="border-b border-ink/25 text-left text-xs uppercase text-wood-700">
                  <th className="py-2 pr-4">Møte</th>
                  <th className="py-2 pr-4">Kunde</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Produkt</th>
                  <th className="py-2 pr-4">Deal size</th>
                  <th className="py-2 pr-4">Signert</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {past.map((meeting) => (
                  <MeetingRow
                    key={meeting.id}
                    meeting={meeting}
                    canEdit={profile.role === "admin" || meeting.seller_id === profile.id}
                    onChanged={refresh}
                  />
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
