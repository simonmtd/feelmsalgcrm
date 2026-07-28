import "server-only";
import type {
  Niche,
  Profile,
  Lead,
  LeadActivity,
  SyncRun,
  Meeting,
  MeetingType,
  ProductType,
  AuditLogEntry,
  Notification,
  LeadStatus,
  FilmingStatus,
  LeadSource,
} from "@/lib/types";
import { DEMO_PASSWORD } from "@/lib/demo/mode";

export interface AppSettingRow {
  key: string;
  value: number;
}

export interface DemoStore {
  niches: Niche[];
  profiles: Profile[];
  leads: Lead[];
  lead_activities: LeadActivity[];
  sync_runs: SyncRun[];
  meetings: Meeting[];
  audit_log: AuditLogEntry[];
  notifications: Notification[];
  app_settings: AppSettingRow[];
  /** email (lowercased) -> password, kept out of the Profile objects so it never reaches a client component */
  credentials: Record<string, string>;
}

function daysAgo(n: number, hour = 9) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

function todayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Monday 00:00 (local time) of the current week — meetings are seeded relative to this so the calendar always shows a populated "this week" view. */
function mondayOfCurrentWeek() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function atWeekday(offsetFromMonday: number, hour: number, minute = 0) {
  const d = new Date(mondayOfCurrentWeek());
  d.setDate(d.getDate() + offsetFromMonday);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function buildSeed(): DemoStore {
  const niches: Niche[] = [
    { id: crypto.randomUUID(), name: "Bygg & Anlegg", slug: "bygg-anlegg", created_at: daysAgo(90) },
    { id: crypto.randomUUID(), name: "Eiendomsmegling", slug: "eiendomsmegling", created_at: daysAgo(90) },
    { id: crypto.randomUUID(), name: "Restaurant & Servering", slug: "restaurant-servering", created_at: daysAgo(80) },
    { id: crypto.randomUUID(), name: "Helse & Velvære", slug: "helse-velvare", created_at: daysAgo(60) },
    { id: crypto.randomUUID(), name: "Bilbransjen", slug: "bilbransjen", created_at: daysAgo(45) },
  ];
  const [bygg, eiendom, restaurant, helse, bil] = niches;

  const admin: Profile = {
    id: crypto.randomUUID(),
    email: "admin@feelm.no",
    full_name: "Kari Andreassen",
    role: "admin",
    active_niche_id: null,
    is_active: true,
    created_at: daysAgo(120),
  };
  const jonas: Profile = {
    id: crypto.randomUUID(),
    email: "jonas@feelm.no",
    full_name: "Jonas Berg",
    role: "seller",
    active_niche_id: bygg.id,
    is_active: true,
    created_at: daysAgo(100),
  };
  const maria: Profile = {
    id: crypto.randomUUID(),
    email: "maria@feelm.no",
    full_name: "Maria Solheim",
    role: "seller",
    active_niche_id: eiendom.id,
    is_active: true,
    created_at: daysAgo(95),
  };
  const thomas: Profile = {
    id: crypto.randomUUID(),
    email: "thomas@feelm.no",
    full_name: "Thomas Iversen",
    role: "seller",
    active_niche_id: restaurant.id,
    is_active: true,
    created_at: daysAgo(70),
  };
  const nina: Profile = {
    id: crypto.randomUUID(),
    email: "nina@feelm.no",
    full_name: "Nina Kristiansen",
    role: "seller",
    active_niche_id: null,
    is_active: false,
    created_at: daysAgo(30),
  };

  const profiles = [admin, jonas, maria, thomas, nina];
  const today = todayDateStr();

  const leads: Lead[] = [];
  const leadActivities: LeadActivity[] = [];

  function addLead(spec: {
    company: string;
    contact: string;
    email: string;
    phone: string;
    niche?: Niche | null;
    status?: LeadStatus;
    filming?: FilmingStatus;
    source?: LeadSource;
    assignedTo?: Profile;
    assignedDaysAgo?: number;
    dealSize?: number | null;
    createdDaysAgo?: number;
    followUpInDays?: number;
  }) {
    const createdAt = daysAgo(spec.createdDaysAgo ?? Math.floor(Math.random() * 14) + 1);
    const assignedDate = spec.assignedTo
      ? spec.assignedDaysAgo === 0
        ? today
        : daysAgo(spec.assignedDaysAgo ?? 0).slice(0, 10)
      : null;
    const lead: Lead = {
      id: crypto.randomUUID(),
      hubspot_contact_id: spec.source === "hubspot" ? `hs-${crypto.randomUUID().slice(0, 8)}` : null,
      company_name: spec.company,
      contact_name: spec.contact,
      email: spec.email,
      phone: spec.phone,
      niche_id: spec.niche?.id ?? null,
      source: spec.source ?? "manual",
      status: spec.status ?? "new",
      deal_size: spec.dealSize ?? null,
      filming_status: spec.filming ?? "not_started",
      assigned_to: spec.assignedTo?.id ?? null,
      assigned_date: assignedDate,
      next_follow_up_at: spec.followUpInDays != null ? daysAgo(-spec.followUpInDays, 12) : null,
      raw_hubspot_data: null,
      created_at: createdAt,
      updated_at: createdAt,
    };
    leads.push(lead);
    return lead;
  }

  function addActivity(lead: Lead, seller: Profile, spec: { type: LeadActivity["type"]; content: string; daysAgo: number }) {
    leadActivities.push({
      id: crypto.randomUUID(),
      lead_id: lead.id,
      seller_id: seller.id,
      type: spec.type,
      content: spec.content,
      created_at: daysAgo(spec.daysAgo, 10 + Math.floor(Math.random() * 6)),
    });
  }

  // --- Bygg & Anlegg (Jonas) ---
  const l1 = addLead({
    company: "Nordvik Bygg AS", contact: "Erik Nordvik", email: "erik@nordvikbygg.no", phone: "91234567",
    niche: bygg, source: "hubspot", status: "contacted", filming: "scheduled",
    assignedTo: jonas, assignedDaysAgo: 0, dealSize: 45000, createdDaysAgo: 5, followUpInDays: 2,
  });
  addActivity(l1, jonas, { type: "call", content: "Ringte Erik, positiv til filmingpakke. Sender tilbud i morgen.", daysAgo: 1 });
  addActivity(l1, jonas, { type: "status_change", content: 'Status endret til "Kontaktet".', daysAgo: 1 });

  addLead({
    company: "Fjellheim Entreprenør", contact: "Silje Haugen", email: "silje@fjellheim-ent.no", phone: "95512340",
    niche: bygg, source: "hubspot", status: "assigned", assignedTo: jonas, assignedDaysAgo: 0, createdDaysAgo: 3,
  });

  const l3 = addLead({
    company: "Solid Bygg & Anlegg", contact: "Anders Fjeld", email: "anders@solidbygg.no", phone: "90045612",
    niche: bygg, source: "manual", status: "follow_up", filming: "filmed",
    assignedTo: jonas, assignedDaysAgo: 4, dealSize: 62000, createdDaysAgo: 9, followUpInDays: 1,
  });
  addActivity(l3, jonas, { type: "note", content: "Filming gjennomført på byggeplass mandag. Venter på tilbakemelding fra Anders før vi sender faktura.", daysAgo: 2 });
  addActivity(l3, jonas, { type: "email", content: "Sendte oppfølgings-epost med lenke til råmateriale.", daysAgo: 1 });

  const l4 = addLead({
    company: "Vestkyst Rehab AS", contact: "Kristian Sæther", email: "kristian@vestkystrehab.no", phone: "93321870",
    niche: bygg, source: "manual", status: "won", filming: "delivered",
    assignedTo: jonas, assignedDaysAgo: 20, dealSize: 89000, createdDaysAgo: 25,
  });
  addActivity(l4, jonas, { type: "status_change", content: 'Status endret til "Vunnet". Signert avtale mottatt.', daysAgo: 6 });

  addLead({
    company: "Ringveien Byggservice", contact: "Hedda Lund", email: "hedda@ringveien-bygg.no", phone: "94456123",
    niche: bygg, source: "hubspot", status: "new", createdDaysAgo: 1,
  });
  addLead({
    company: "BetongPartner AS", contact: "Magnus Rein", email: "magnus@betongpartner.no", phone: "92287744",
    niche: bygg, source: "hubspot", status: "new", createdDaysAgo: 2,
  });
  addLead({
    company: "Høyden Tak & Fasade", contact: "Camilla Vik", email: "camilla@hoydentak.no", phone: "97711223",
    niche: bygg, source: "manual", status: "lost", createdDaysAgo: 30,
  });

  // --- Eiendomsmegling (Maria) ---
  const l5 = addLead({
    company: "Sentrum Eiendomsmegling", contact: "Ole Kristian Berge", email: "ole@sentrummegling.no", phone: "90112233",
    niche: eiendom, source: "hubspot", status: "contacted", filming: "scheduled",
    assignedTo: maria, assignedDaysAgo: 0, dealSize: 38000, createdDaysAgo: 4, followUpInDays: 3,
  });
  addActivity(l5, maria, { type: "call", content: "God samtale, ønsker filmingpakke for tre boliger i Q3.", daysAgo: 1 });

  addLead({
    company: "Kystmegleren AS", contact: "Marte Lindqvist", email: "marte@kystmegleren.no", phone: "95590012",
    niche: eiendom, source: "hubspot", status: "assigned", assignedTo: maria, assignedDaysAgo: 0, createdDaysAgo: 2,
  });

  const l7 = addLead({
    company: "Bolig&Co Meglerhus", contact: "Johannes Aas", email: "johannes@boligco.no", phone: "91678234",
    niche: eiendom, source: "manual", status: "follow_up", filming: "filmed",
    assignedTo: maria, assignedDaysAgo: 6, dealSize: 51000, createdDaysAgo: 12, followUpInDays: 0,
  });
  addActivity(l7, maria, { type: "note", content: "Levert råklipp. Johannes vil ha en kortere versjon til Instagram også.", daysAgo: 3 });
  addActivity(l7, maria, { type: "call", content: "Avtalte levering av kortversjon innen fredag.", daysAgo: 1 });

  addLead({
    company: "Prestisje Eiendom", contact: "Sara Bakken", email: "sara@prestisjeeiendom.no", phone: "96234501",
    niche: eiendom, source: "hubspot", status: "won", filming: "delivered",
    assignedTo: maria, assignedDaysAgo: 18, dealSize: 74000, createdDaysAgo: 22,
  });
  addLead({
    company: "Nordre Eiendomsmegling", contact: "Fredrik Holm", email: "fredrik@nordremegling.no", phone: "93456781",
    niche: eiendom, source: "hubspot", status: "new", createdDaysAgo: 1,
  });
  addLead({
    company: "Havutsikt Megling", contact: "Line Dahl", email: "line@havutsiktmegling.no", phone: "97812340",
    niche: eiendom, source: "manual", status: "new", createdDaysAgo: 3,
  });

  // --- Restaurant & Servering (Thomas) ---
  const l8 = addLead({
    company: "Fjordbrygga Restaurant", contact: "Petter Solvang", email: "petter@fjordbrygga.no", phone: "90998877",
    niche: restaurant, source: "hubspot", status: "contacted", filming: "scheduled",
    assignedTo: thomas, assignedDaysAgo: 0, dealSize: 29000, createdDaysAgo: 6, followUpInDays: 2,
  });
  addActivity(l8, thomas, { type: "call", content: "Petter vil filme ny meny-lansering i august.", daysAgo: 2 });

  addLead({
    company: "Osteria Bella", contact: "Ida Grønli", email: "ida@osteriabella.no", phone: "95123456",
    niche: restaurant, source: "manual", status: "assigned", assignedTo: thomas, assignedDaysAgo: 0, createdDaysAgo: 2,
  });

  addLead({
    company: "Krydderhuset AS", contact: "Vegard Skog", email: "vegard@krydderhuset.no", phone: "91345670",
    niche: restaurant, source: "hubspot", status: "lost", createdDaysAgo: 28,
  });
  addLead({
    company: "Nordlys Kaffebar", contact: "Tone Bergli", email: "tone@nordlyskaffe.no", phone: "94678123",
    niche: restaurant, source: "hubspot", status: "new", createdDaysAgo: 1,
  });
  addLead({
    company: "Bryggeriet Pub & Kjøkken", contact: "Simen Fossum", email: "simen@bryggerietpub.no", phone: "96789012",
    niche: restaurant, source: "manual", status: "won", filming: "delivered",
    assignedTo: thomas, assignedDaysAgo: 15, dealSize: 56000, createdDaysAgo: 19,
  });

  // --- Helse & Velvære (ingen selger har valgt denne nichen ennå) ---
  addLead({ company: "Balanse Fysioterapi", contact: "Amalie Strand", email: "amalie@balansefysio.no", phone: "90223344", niche: helse, source: "hubspot", status: "new", createdDaysAgo: 2 });
  addLead({ company: "Ro Spa & Velvære", contact: "Håkon Reme", email: "hakon@rospa.no", phone: "95667788", niche: helse, source: "hubspot", status: "new", createdDaysAgo: 4 });
  addLead({ company: "Pulse Trening AS", contact: "Julie Vangen", email: "julie@pulsetrening.no", phone: "93998877", niche: helse, source: "manual", status: "new", createdDaysAgo: 1 });
  addLead({ company: "Klarhet Psykologtjenester", contact: "Bjørn Eide", email: "bjorn@klarhetpsyk.no", phone: "97112233", niche: helse, source: "hubspot", status: "new", createdDaysAgo: 6 });

  // --- Bilbransjen (ingen selger har valgt denne nichen ennå) ---
  addLead({ company: "Motorpartner AS", contact: "Kaja Lien", email: "kaja@motorpartner.no", phone: "91556677", niche: bil, source: "hubspot", status: "new", createdDaysAgo: 3 });
  addLead({ company: "Kystbil Verksted", contact: "Trym Nygård", email: "trym@kystbilverksted.no", phone: "94223311", niche: bil, source: "manual", status: "new", createdDaysAgo: 5 });
  addLead({ company: "Elektrisk Bilhus", contact: "Emma Wold", email: "emma@elektriskbilhus.no", phone: "96334455", niche: bil, source: "hubspot", status: "new", createdDaysAgo: 2 });

  // --- Ikke klassifisert ennå ---
  addLead({ company: "Rask Dekk & Service", contact: "Aksel Rud", email: "aksel@raskdekk.no", phone: "90887766", source: "apollo", status: "new", createdDaysAgo: 1 });
  addLead({ company: "Nybrott Consulting", contact: "Thea Myklebust", email: "thea@nybrottconsulting.no", phone: "95443322", source: "apollo", status: "new", createdDaysAgo: 2 });
  addLead({ company: "Sundby Interiør", contact: "Malin Sundby", email: "malin@sundbyinterior.no", phone: "97665544", source: "apollo", status: "new", createdDaysAgo: 1 });

  const syncRuns: SyncRun[] = [
    {
      id: crypto.randomUUID(),
      started_at: daysAgo(2, 6),
      finished_at: daysAgo(2, 6),
      records_synced: 14,
      status: "success",
      error: null,
    },
    {
      id: crypto.randomUUID(),
      started_at: daysAgo(1, 6),
      finished_at: daysAgo(1, 6),
      records_synced: 0,
      status: "error",
      error: "HubSpot API-feil (401): Unauthorized. Sjekk HUBSPOT_ACCESS_TOKEN.",
    },
    {
      id: crypto.randomUUID(),
      started_at: daysAgo(0, 6),
      finished_at: daysAgo(0, 6),
      records_synced: 8,
      status: "success",
      error: null,
    },
  ];

  function addMeeting(spec: {
    seller: Profile;
    title: string;
    type: MeetingType;
    day: number;
    startHour: number;
    startMinute?: number;
    endHour: number;
    endMinute?: number;
    location?: string;
    lead?: Lead;
    dealSize?: number;
    product?: ProductType;
  }): Meeting {
    return {
      id: crypto.randomUUID(),
      seller_id: spec.seller.id,
      lead_id: spec.lead?.id ?? null,
      title: spec.title,
      type: spec.type,
      starts_at: atWeekday(spec.day, spec.startHour, spec.startMinute ?? 0),
      ends_at: atWeekday(spec.day, spec.endHour, spec.endMinute ?? 0),
      location: spec.location ?? null,
      notes: null,
      deal_size: spec.dealSize ?? null,
      product_type: spec.product ?? null,
      created_at: daysAgo(3),
    };
  }

  const leadByName = (name: string) => leads.find((l) => l.company_name === name);

  const meetings: Meeting[] = [
    addMeeting({ seller: admin, title: "Ukentlig salgsmøte", type: "internal", day: 0, startHour: 9, endHour: 9, endMinute: 30, location: "Teams" }),

    addMeeting({ seller: jonas, title: "Salgsmøte: Nordvik Bygg AS", type: "sales_meeting", day: 0, startHour: 10, endHour: 10, endMinute: 45, location: "Teams", lead: l1, dealSize: 45000, product: "campaign_film" }),
    addMeeting({ seller: jonas, title: "Demo for Fjellheim Entreprenør", type: "demo", day: 2, startHour: 13, endHour: 13, endMinute: 30, lead: leadByName("Fjellheim Entreprenør"), dealSize: 32000, product: "social_media" }),
    addMeeting({ seller: jonas, title: "Oppfølging: Solid Bygg & Anlegg", type: "follow_up", day: 3, startHour: 11, endHour: 11, endMinute: 30, lead: l3, dealSize: 62000, product: "production_retainer" }),

    addMeeting({ seller: maria, title: "Salgsmøte: Sentrum Eiendomsmegling", type: "sales_meeting", day: 0, startHour: 13, endHour: 13, endMinute: 45, location: "Kontoret", lead: l5, dealSize: 38000, product: "campaign_film" }),
    addMeeting({ seller: maria, title: "Demo for Kystmegleren AS", type: "demo", day: 1, startHour: 9, startMinute: 30, endHour: 10, lead: leadByName("Kystmegleren AS"), dealSize: 27000, product: "social_media" }),
    addMeeting({ seller: maria, title: "Oppfølging: Bolig&Co Meglerhus", type: "follow_up", day: 4, startHour: 14, endHour: 14, endMinute: 30, lead: l7, dealSize: 51000, product: "production_retainer" }),

    addMeeting({ seller: thomas, title: "Salgsmøte: Fjordbrygga Restaurant", type: "sales_meeting", day: 1, startHour: 11, endHour: 11, endMinute: 45, location: "Teams", lead: l8, dealSize: 29000, product: "campaign_film" }),
    addMeeting({ seller: thomas, title: "Demo for Osteria Bella", type: "demo", day: 2, startHour: 15, endHour: 15, endMinute: 30, lead: leadByName("Osteria Bella"), dealSize: 24000, product: "event_film" }),
    addMeeting({ seller: thomas, title: "Internt: ukeplanlegging", type: "internal", day: 3, startHour: 9, endHour: 9, endMinute: 30 }),
  ];

  const audit_log: AuditLogEntry[] = [
    {
      id: crypto.randomUUID(),
      actor_id: admin.id,
      actor_email: admin.email,
      action: "assignment.trigger",
      target_type: null,
      target_id: null,
      details: { assigned: 12 },
      created_at: daysAgo(1, 6),
    },
    {
      id: crypto.randomUUID(),
      actor_id: admin.id,
      actor_email: admin.email,
      action: "niche.create",
      target_type: "niche",
      target_id: bil.id,
      details: { name: "Bilbransjen" },
      created_at: daysAgo(2, 11),
    },
    {
      id: crypto.randomUUID(),
      actor_id: admin.id,
      actor_email: admin.email,
      action: "seller.create",
      target_type: "profile",
      target_id: nina.id,
      details: { email: nina.email, role: "seller" },
      created_at: daysAgo(3, 9),
    },
  ];

  const notifications: Notification[] = [
    {
      id: crypto.randomUUID(),
      user_id: jonas.id,
      type: "lead_assigned",
      message: "Du har fått 2 nye leads tildelt i dag.",
      lead_id: null,
      read_at: null,
      created_at: daysAgo(0, 6),
    },
    {
      id: crypto.randomUUID(),
      user_id: maria.id,
      type: "lead_assigned",
      message: "Du har fått 2 nye leads tildelt i dag.",
      lead_id: null,
      read_at: null,
      created_at: daysAgo(0, 6),
    },
  ];

  const credentials: Record<string, string> = {};
  for (const p of profiles) credentials[p.email.toLowerCase()] = DEMO_PASSWORD;

  return {
    niches,
    profiles,
    leads,
    lead_activities: leadActivities,
    sync_runs: syncRuns,
    meetings,
    audit_log,
    notifications,
    app_settings: [{ key: "daily_lead_count", value: 10 }],
    credentials,
  };
}

declare global {
  var __DEMO_STORE__: DemoStore | undefined;
}

export function getDemoStore(): DemoStore {
  if (!globalThis.__DEMO_STORE__) {
    globalThis.__DEMO_STORE__ = buildSeed();
  }
  return globalThis.__DEMO_STORE__;
}
