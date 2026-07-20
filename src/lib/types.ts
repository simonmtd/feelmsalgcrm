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
  filming_status: FilmingStatus;
  assigned_to: string | null;
  assigned_date: string | null;
  next_follow_up_at: string | null;
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
