export type UserRole = "seller" | "admin";

export type LeadStatus =
  | "new"
  | "assigned"
  | "contacted"
  | "follow_up"
  | "won"
  | "lost";

export type LeadSource = "apollo" | "hubspot" | "manual";

export type FilmingStatus =
  | "not_started"
  | "scheduled"
  | "filmed"
  | "delivered";

export type ActivityType =
  | "note"
  | "call"
  | "email"
  | "status_change"
  | "filming_update";

export interface Niche {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  active_niche_id: string | null;
  is_active: boolean;
  created_at: string;
  active_niche?: Niche | null;
}

export interface Lead {
  id: string;
  hubspot_contact_id: string | null;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  niche_id: string | null;
  source: LeadSource;
  status: LeadStatus;
  deal_size: number | null;
  website: string | null;
  industry: string | null;
  job_title: string | null;
  filming_status: FilmingStatus;
  assigned_to: string | null;
  assigned_date: string | null;
  next_follow_up_at: string | null;
  follow_up_reminded_at: string | null;
  apollo_person_id: string | null;
  enriched_at: string | null;
  org_number: string | null;
  raw_hubspot_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  niche?: Niche | null;
  assigned_seller?: Pick<Profile, "id" | "full_name" | "email"> | null;
}

export interface LeadActivity {
  id: string;
  lead_id: string;
  seller_id: string | null;
  type: ActivityType;
  content: string;
  created_at: string;
  seller?: Pick<Profile, "id" | "full_name" | "email"> | null;
}

export interface SyncRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  records_synced: number;
  status: "running" | "success" | "error";
  error: string | null;
}

export type NotificationType = "lead_assigned" | "lead_reassigned" | "system";

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  message: string;
  lead_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  actor_email: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "seller.create": "Opprettet bruker",
  "seller.activate": "Aktiverte bruker",
  "seller.deactivate": "Deaktiverte bruker",
  "seller.reset_password": "Tilbakestilte passord",
  "niche.create": "Opprettet niche",
  "lead.reassign": "Omfordelte lead",
  "lead.bulk_assign": "Masse-fordelte leads",
  "lead.classify": "Klassifiserte lead",
  "settings.daily_lead_count": "Endret daglig lead-antall",
  "sync.trigger": "Startet HubSpot-sync",
  "assignment.trigger": "Startet daglig fordeling",
};

export type MeetingType = "sales_meeting" | "demo" | "follow_up" | "internal" | "other";

/** What Feelm is trying to sell in a given meeting. */
export type ProductType =
  | "campaign_film"
  | "production_retainer"
  | "social_media"
  | "corporate_film"
  | "event_film"
  | "other";

export interface Meeting {
  id: string;
  seller_id: string;
  lead_id: string | null;
  title: string;
  type: MeetingType;
  starts_at: string;
  ends_at: string;
  location: string | null;
  notes: string | null;
  deal_size: number | null;
  product_type: ProductType | null;
  created_at: string;
  seller?: Pick<Profile, "id" | "full_name" | "email"> | null;
  lead?: Pick<Lead, "id" | "company_name" | "contact_name"> | null;
}

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Ny",
  assigned: "Tildelt",
  contacted: "Kontaktet",
  follow_up: "Følges opp",
  won: "Vunnet",
  lost: "Tapt",
};

export const FILMING_STATUS_LABELS: Record<FilmingStatus, string> = {
  not_started: "Ikke startet",
  scheduled: "Filming planlagt",
  filmed: "Filmet",
  delivered: "Levert",
};

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  note: "Notat",
  call: "Samtale",
  email: "E-post",
  status_change: "Statusendring",
  filming_update: "Filming-oppdatering",
};

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  sales_meeting: "Salgsmøte",
  demo: "Demo",
  follow_up: "Oppfølging",
  internal: "Internt møte",
  other: "Annet",
};

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  campaign_film: "Kampanjefilm",
  production_retainer: "Retainer produksjon",
  social_media: "Sosiale medier",
  corporate_film: "Bedriftsfilm",
  event_film: "Eventfilm",
  other: "Annet",
};
