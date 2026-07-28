"use client";

import { useMemo, useState, useActionState } from "react";
import { Search, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { createMeeting, type MeetingActionState } from "@/lib/actions/meetings";
import { avatarToneFor, initialsFor } from "@/lib/avatar-color";
import {
  getMonday,
  addDays,
  isSameDay,
  formatWeekRange,
  hourDecimal,
  formatHourLabel,
  formatTimeRange,
  CALENDAR_START_HOUR,
  CALENDAR_END_HOUR,
  CALENDAR_ROW_HEIGHT,
  MIN_MEETING_HEIGHT,
  WEEKDAY_LABELS,
} from "@/lib/calendar-utils";
import { MEETING_TYPE_LABELS, PRODUCT_TYPE_LABELS } from "@/lib/types";
import type { Lead, Meeting, MeetingType, Profile } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";

const MEETING_STYLES: Record<MeetingType, { bg: string; text: string; borderL: string }> = {
  sales_meeting: { bg: "bg-gold-400", text: "text-ink", borderL: "border-l-gold-600" },
  demo: { bg: "bg-himmel-300", text: "text-ink", borderL: "border-l-himmel-500" },
  follow_up: { bg: "bg-forest-400", text: "text-ink", borderL: "border-l-forest-700" },
  internal: { bg: "bg-wood-200", text: "text-wood-900", borderL: "border-l-wood-600" },
  other: { bg: "bg-purple-300", text: "text-ink", borderL: "border-l-purple-500" },
};

const initialState: MeetingActionState = {};

export function TeamCalendar({
  currentProfile,
  team,
  meetings,
  leads,
}: {
  currentProfile: Profile;
  team: Profile[];
  meetings: Meeting[];
  leads: Pick<Lead, "id" | "company_name" | "contact_name">[];
}) {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [defaultDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [state, formAction] = useActionState(createMeeting, initialState);

  const filteredTeam = useMemo(
    () => team.filter((p) => (p.full_name ?? p.email).toLowerCase().includes(search.toLowerCase())),
    [team, search]
  );

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const visibleMeetings = useMemo(
    () => (selectedSellerId ? meetings.filter((m) => m.seller_id === selectedSellerId) : meetings),
    [meetings, selectedSellerId]
  );

  const hours = useMemo(
    () => Array.from({ length: CALENDAR_END_HOUR - CALENDAR_START_HOUR }, (_, i) => CALENDAR_START_HOUR + i),
    []
  );

  const gridHeight = (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * CALENDAR_ROW_HEIGHT;

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <Card className="lg:w-72 lg:shrink-0">
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-wood-600" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søk i teamet…"
              className="pl-9"
            />
          </div>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => setSelectedSellerId(null)}
              className={cn(
                "flex items-center gap-3 rounded-sm border-2 border-transparent p-2.5 text-left transition-colors hover:bg-gold-100",
                selectedSellerId === null && "border-ink bg-gold-200 shadow-[2px_2px_0_0_var(--color-ink)]"
              )}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border-2 border-ink bg-wood-900 font-pixel text-[10px] text-gold-100">
                Alle
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">Hele teamet</span>
                <span className="block truncate text-xs text-wood-700">{team.length} personer</span>
              </span>
            </button>
            {filteredTeam.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => setSelectedSellerId(member.id === selectedSellerId ? null : member.id)}
                className={cn(
                  "flex items-center gap-3 rounded-sm border-2 border-transparent p-2.5 text-left transition-colors hover:bg-gold-100",
                  selectedSellerId === member.id && "border-ink bg-gold-200 shadow-[2px_2px_0_0_var(--color-ink)]"
                )}
              >
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border-2 border-ink text-sm font-bold",
                    avatarToneFor(member.id)
                  )}
                >
                  {initialsFor(member.full_name ?? member.email)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {member.full_name ?? member.email}
                  </span>
                  <span className="block truncate text-xs text-wood-700">
                    {member.role === "admin" ? "Admin" : member.active_niche?.name ?? "Ingen niche valgt"}
                  </span>
                </span>
              </button>
            ))}
            {!filteredTeam.length && (
              <p className="px-2.5 py-4 text-center text-sm text-wood-700">Fant ingen i teamet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setWeekStart((w) => addDays(w, -7))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[11rem] text-center text-sm font-medium text-wood-800">
                {formatWeekRange(weekStart)}
              </span>
              <Button type="button" variant="outline" size="sm" onClick={() => setWeekStart((w) => addDays(w, 7))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setWeekStart(getMonday(new Date()))}>
                I dag
              </Button>
            </div>
            <Button type="button" size="sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              Nytt møte
            </Button>
          </CardContent>
        </Card>

        {showForm && (
          <Card>
            <CardContent className="pt-6">
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
                {currentProfile.role === "admin" && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="seller_id">Selger</Label>
                    <Select id="seller_id" name="seller_id" defaultValue={currentProfile.id}>
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
                <div className="flex flex-col gap-1.5 lg:col-span-2">
                  <Label htmlFor="location">Sted (valgfritt)</Label>
                  <Input id="location" name="location" placeholder="Teams, kontoret, hos kunden…" />
                </div>
                <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-4">
                  <Button type="submit">Legg til møte</Button>
                  {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
                  {state?.success && <p className="text-sm text-green-600">{state.success}</p>}
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="overflow-x-auto pt-6">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[56px_repeat(7,1fr)]">
                <div />
                {weekDays.map((day) => {
                  const today = isSameDay(day, new Date());
                  return (
                    <div key={day.toISOString()} className="pb-3 text-center">
                      <p className="text-xs font-medium uppercase tracking-wide text-wood-600">
                        {WEEKDAY_LABELS[day.getDay() === 0 ? 6 : day.getDay() - 1]}
                      </p>
                      <p
                        className={cn(
                          "mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-sm border-2 border-ink text-sm font-bold",
                          today ? "border-2 border-ink bg-gold-500 text-ink" : "text-wood-800"
                        )}
                      >
                        {day.getDate()}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-[56px_repeat(7,1fr)]">
                <div className="relative" style={{ height: gridHeight }}>
                  {hours.map((h, i) => (
                    <div
                      key={h}
                      className="absolute right-2 -translate-y-1/2 text-xs text-wood-600"
                      style={{ top: i * CALENDAR_ROW_HEIGHT }}
                    >
                      {formatHourLabel(h)}
                    </div>
                  ))}
                </div>

                {weekDays.map((day) => {
                  const dayMeetings = visibleMeetings.filter((m) => isSameDay(new Date(m.starts_at), day));
                  return (
                    <div
                      key={day.toISOString()}
                      className="relative border-l border-ink/15"
                      style={{ height: gridHeight }}
                    >
                      {hours.map((h, i) => (
                        <div
                          key={h}
                          className="absolute left-0 right-0 border-t border-ink/15"
                          style={{ top: i * CALENDAR_ROW_HEIGHT }}
                        />
                      ))}
                      {dayMeetings.map((meeting) => {
                        const start = new Date(meeting.starts_at);
                        const end = new Date(meeting.ends_at);
                        const startOffset = Math.max(0, hourDecimal(start) - CALENDAR_START_HOUR);
                        const endOffset = Math.min(
                          CALENDAR_END_HOUR - CALENDAR_START_HOUR,
                          hourDecimal(end) - CALENDAR_START_HOUR
                        );
                        const top = startOffset * CALENDAR_ROW_HEIGHT;
                        const height = Math.max(
                          MIN_MEETING_HEIGHT,
                          (endOffset - startOffset) * CALENDAR_ROW_HEIGHT - 4
                        );
                        const styles = MEETING_STYLES[meeting.type];
                        // Each line is ~13px; only render what actually fits so text is never clipped mid-word.
                        const showTime = height >= 34;
                        const showSeller = !selectedSellerId && height >= 50;
                        return (
                          <div
                            key={meeting.id}
                            className={cn(
                              "absolute left-1 right-1 flex flex-col overflow-hidden rounded-sm border border-ink border-l-4 px-1.5 py-1 shadow-[1px_1px_0_0_var(--color-ink)]",
                              styles.bg,
                              styles.borderL
                            )}
                            style={{ top, height }}
                            title={[
                              meeting.title,
                              formatTimeRange(meeting.starts_at, meeting.ends_at),
                              meeting.seller?.full_name,
                              meeting.lead?.company_name,
                              meeting.product_type && PRODUCT_TYPE_LABELS[meeting.product_type],
                              meeting.deal_size != null ? formatCurrency(meeting.deal_size) : null,
                            ]
                              .filter(Boolean)
                              .join(" — ")}
                          >
                            <p
                              className={cn(
                                "truncate text-[11px] font-semibold leading-[13px]",
                                styles.text
                              )}
                            >
                              {meeting.title}
                            </p>
                            {showTime && (
                              <p className="truncate text-[10px] leading-[13px] text-wood-800">
                                {formatTimeRange(meeting.starts_at, meeting.ends_at)}
                              </p>
                            )}
                            {showSeller && (
                              <p className="truncate text-[10px] leading-[13px] text-wood-700">
                                {meeting.seller?.full_name ?? "Ukjent"}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
