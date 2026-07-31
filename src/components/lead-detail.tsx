"use client";

import { useState, useTransition } from "react";
import { Pencil, Sparkles, Phone, PhoneOff, Voicemail, ThumbsDown, ThumbsUp, CalendarCheck } from "lucide-react";
import {
  updateLeadStatus,
  updateLeadFilmingStatus,
  updateLeadDetails,
  updateLeadContact,
  enrichLead,
  logCallOutcome,
  addLeadActivity,
} from "@/lib/actions/leads";
import type { CallOutcome } from "@/lib/actions/leads";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import {
  LEAD_STATUS_LABELS,
  FILMING_STATUS_LABELS,
  ACTIVITY_TYPE_LABELS,
} from "@/lib/types";
import { LEAD_STATUS_VARIANT, FILMING_STATUS_VARIANT } from "@/lib/status-styles";
import type { Lead, LeadActivity, ActivityType, LeadStatus, FilmingStatus } from "@/lib/types";

export function LeadDetail({
  lead,
  activities,
}: {
  lead: Lead;
  activities: LeadActivity[];
}) {
  const [isPending, startTransition] = useTransition();
  const [dealSize, setDealSize] = useState(lead.deal_size?.toString() ?? "");
  const [followUp, setFollowUp] = useState(
    lead.next_follow_up_at ? lead.next_follow_up_at.slice(0, 10) : ""
  );
  const [activityType, setActivityType] = useState<ActivityType>("call");
  const [note, setNote] = useState("");

  const [editingContact, setEditingContact] = useState(false);
  const [enrichMsg, setEnrichMsg] = useState<string | null>(null);
  const [enriching, startEnrich] = useTransition();
  const [contact, setContact] = useState({
    company_name: lead.company_name ?? "",
    contact_name: lead.contact_name ?? "",
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    website: lead.website ?? "",
    industry: lead.industry ?? "",
    job_title: lead.job_title ?? "",
  });

  function saveContact() {
    startTransition(async () => {
      await updateLeadContact(lead.id, contact);
      setEditingContact(false);
    });
  }

  function runEnrich() {
    setEnrichMsg(null);
    startEnrich(async () => {
      const res = await enrichLead(lead.id);
      setEnrichMsg(res.message);
    });
  }

  const [outcomeMsg, setOutcomeMsg] = useState<string | null>(null);
  function registerOutcome(outcome: CallOutcome, label: string) {
    setOutcomeMsg(null);
    startTransition(async () => {
      await logCallOutcome(lead.id, outcome);
      setOutcomeMsg(`Registrert: ${label}.`);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Ring &amp; registrer utfall</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {lead.phone ? (
              <a
                href={`tel:${lead.phone}`}
                className="flex items-center justify-center gap-2 rounded-sm border-2 border-ink bg-forest-600 px-4 py-3 text-lg font-bold text-parchment shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:-translate-y-0.5"
              >
                <Phone className="h-5 w-5" /> Ring {lead.phone}
              </a>
            ) : (
              <div className="flex items-center justify-center gap-2 rounded-sm border-2 border-dashed border-ink/40 px-4 py-3 text-sm text-wood-600">
                <PhoneOff className="h-4 w-4" /> Ingen telefon — bruk «Berik» eller «Rediger»
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(
                [
                  ["no_answer", "Ikke svar", PhoneOff],
                  ["voicemail", "La igjen beskjed", Voicemail],
                  ["interested", "Interessert", ThumbsUp],
                  ["meeting_booked", "Møte booket", CalendarCheck],
                  ["not_interested", "Ikke interessert", ThumbsDown],
                ] as const
              ).map(([key, label, Icon]) => (
                <Button
                  key={key}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  className="justify-start"
                  onClick={() => registerOutcome(key, label)}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" /> {label}
                </Button>
              ))}
            </div>
            {outcomeMsg && <p className="text-sm text-forest-700">{outcomeMsg}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-lg">
                  {lead.company_name ?? "Ukjent firma"}
                </CardTitle>
                <p className="text-sm text-wood-700">{lead.contact_name ?? "–"}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {lead.niche && <Badge>{lead.niche.name}</Badge>}
                {!editingContact && (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={enriching}
                      onClick={runEnrich}
                      title="Hent manglende tlf/e-post fra Apollo"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {enriching ? "Beriker…" : "Berik"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingContact(true)}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Rediger
                    </Button>
                  </>
                )}
              </div>
            </div>
            {enrichMsg && (
              <p className="mt-2 text-xs text-forest-700">{enrichMsg}</p>
            )}
          </CardHeader>
          {editingContact ? (
            <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              {(
                [
                  ["company_name", "Firma"],
                  ["contact_name", "Kontaktperson"],
                  ["email", "E-post"],
                  ["phone", "Telefon"],
                  ["website", "Nettside"],
                  ["industry", "Bransje"],
                  ["job_title", "Tittel"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <Label htmlFor={`c-${key}`}>{label}</Label>
                  <Input
                    id={`c-${key}`}
                    value={contact[key]}
                    onChange={(e) => setContact((c) => ({ ...c, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="flex items-end gap-2 sm:col-span-2">
                <Button type="button" size="sm" disabled={isPending} onClick={saveContact}>
                  {isPending ? "Lagrer…" : "Lagre"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => {
                    setEditingContact(false);
                    setContact({
                      company_name: lead.company_name ?? "",
                      contact_name: lead.contact_name ?? "",
                      email: lead.email ?? "",
                      phone: lead.phone ?? "",
                      website: lead.website ?? "",
                      industry: lead.industry ?? "",
                      job_title: lead.job_title ?? "",
                    });
                  }}
                >
                  Avbryt
                </Button>
              </div>
            </CardContent>
          ) : (
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-wood-700">E-post</p>
                <p className="text-ink">
                  {lead.email ? (
                    <a href={`mailto:${lead.email}`} className="hover:underline">
                      {lead.email}
                    </a>
                  ) : (
                    "–"
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-wood-700">Telefon</p>
                <p className="text-ink">
                  {lead.phone ? (
                    <a href={`tel:${lead.phone}`} className="font-mono hover:underline">
                      {lead.phone}
                    </a>
                  ) : (
                    <span className="text-red-600">Mangler – klikk «Rediger»</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-wood-700">Nettside</p>
                <p className="truncate text-ink">
                  {lead.website ? (
                    <a
                      href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {lead.website}
                    </a>
                  ) : (
                    "–"
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-wood-700">Bransje</p>
                <p className="text-ink">{lead.industry ?? "–"}</p>
              </div>
              <div>
                <p className="text-xs text-wood-700">Tittel</p>
                <p className="text-ink">{lead.job_title ?? "–"}</p>
              </div>
              <div>
                <p className="text-xs text-wood-700">Kilde</p>
                <p className="text-ink">{lead.source}</p>
              </div>
              <div>
                <p className="text-xs text-wood-700">Tildelt dato</p>
                <p className="text-ink">{lead.assigned_date ?? "–"}</p>
              </div>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hva er sagt / aktivitet</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 rounded-sm border-2 border-ink bg-wood-100 p-3">
              <div className="flex gap-2">
                <Select
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value as ActivityType)}
                  className="w-40"
                >
                  {(["call", "email", "note"] as ActivityType[]).map((type) => (
                    <option key={type} value={type}>
                      {ACTIVITY_TYPE_LABELS[type]}
                    </option>
                  ))}
                </Select>
              </div>
              <Textarea
                placeholder="Hva ble sagt / avtalt?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <Button
                size="sm"
                className="self-end"
                disabled={isPending || !note.trim()}
                onClick={() =>
                  startTransition(async () => {
                    await addLeadActivity(lead.id, activityType, note);
                    setNote("");
                  })
                }
              >
                Legg til
              </Button>
            </div>

            <div className="flex flex-col gap-3">
              {activities.length === 0 && (
                <p className="text-sm text-wood-700">Ingen aktivitet registrert ennå.</p>
              )}
              {activities.map((activity) => (
                <div key={activity.id} className="border-b border-ink/15 pb-3 last:border-0">
                  <div className="flex items-center justify-between">
                    <Badge variant="default">{ACTIVITY_TYPE_LABELS[activity.type]}</Badge>
                    <span className="text-xs text-wood-600">
                      {formatDateTime(activity.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-wood-800">{activity.content}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Lead-status</Label>
              <Select
                defaultValue={lead.status}
                disabled={isPending}
                onChange={(e) =>
                  startTransition(() =>
                    updateLeadStatus(lead.id, e.target.value as LeadStatus)
                  )
                }
              >
                {Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <Badge variant={LEAD_STATUS_VARIANT[lead.status]} className="w-fit">
                Nåværende: {LEAD_STATUS_LABELS[lead.status]}
              </Badge>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Filming-status</Label>
              <Select
                defaultValue={lead.filming_status}
                disabled={isPending}
                onChange={(e) =>
                  startTransition(() =>
                    updateLeadFilmingStatus(lead.id, e.target.value as FilmingStatus)
                  )
                }
              >
                {Object.entries(FILMING_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <Badge variant={FILMING_STATUS_VARIANT[lead.filming_status]} className="w-fit">
                Nåværende: {FILMING_STATUS_LABELS[lead.filming_status]}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Deal &amp; oppfølging</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deal_size">Deal size (NOK)</Label>
              <div className="flex gap-2">
                <Input
                  id="deal_size"
                  type="number"
                  min={0}
                  value={dealSize}
                  onChange={(e) => setDealSize(e.target.value)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(() =>
                      updateLeadDetails(lead.id, {
                        deal_size: dealSize ? Number(dealSize) : null,
                      })
                    )
                  }
                >
                  Lagre
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="follow_up">Neste oppfølging</Label>
              <div className="flex gap-2">
                <Input
                  id="follow_up"
                  type="date"
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(() =>
                      updateLeadDetails(lead.id, {
                        next_follow_up_at: followUp
                          ? new Date(followUp).toISOString()
                          : null,
                      })
                    )
                  }
                >
                  Lagre
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
