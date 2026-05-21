/**
 * Lead domain types. Status is the single source of truth for the entire
 * pipeline — it's used by the API contract, the UI badges, the Kanban
 * columns, and the transition rules in `statusRules.ts`. Keep it tight.
 */

export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "CONVERTED",
  "LOST",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: LeadStatus;
  source?: string;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}

/** Shape accepted by POST /leads. id/timestamps are server-assigned. */
export type CreateLeadInput = Pick<Lead, "name" | "email"> &
  Partial<Pick<Lead, "phone" | "source" | "status">>;

/** Shape accepted by PATCH /leads/:id. All fields optional. */
export type UpdateLeadInput = Partial<
  Pick<Lead, "name" | "email" | "phone" | "source" | "status">
>;

/** Human labels for status — kept here so badges/filters/menus stay in sync. */
export const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  CONVERTED: "Converted",
  LOST: "Lost",
};
