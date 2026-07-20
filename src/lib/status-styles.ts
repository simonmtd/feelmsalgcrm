import type { BadgeProps } from "@/components/ui/badge";
import type { FilmingStatus, LeadStatus } from "@/lib/types";

export const LEAD_STATUS_VARIANT: Record<LeadStatus, BadgeProps["variant"]> = {
  new: "blue",
  assigned: "purple",
  contacted: "amber",
  follow_up: "amber",
  won: "green",
  lost: "red",
};

export const FILMING_STATUS_VARIANT: Record<FilmingStatus, BadgeProps["variant"]> = {
  not_started: "default",
  scheduled: "amber",
  filmed: "blue",
  delivered: "green",
};
