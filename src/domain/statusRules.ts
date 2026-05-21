import type { LeadStatus } from "./lead";

/**
 * The pipeline:
 *
 *   NEW → CONTACTED → QUALIFIED → CONVERTED
 *    ↘        ↘         ↘
 *               LOST (terminal)
 *
 * Rules:
 *  - Forward one step at a time along the main path.
 *  - LOST reachable from any non-terminal status.
 *  - CONVERTED and LOST are terminal — nothing leaves them.
 *
 * The transition map lives here so the API mock, the row action menu, and
 * the Kanban drag-target logic can all read from the same source. If the
 * rules change, we change them in one place.
 */
const TRANSITIONS: Record<LeadStatus, ReadonlyArray<LeadStatus>> = {
  NEW: ["CONTACTED", "LOST"],
  CONTACTED: ["QUALIFIED", "LOST"],
  QUALIFIED: ["CONVERTED", "LOST"],
  CONVERTED: [],
  LOST: [],
};

export function getValidNextStatuses(
  current: LeadStatus,
): ReadonlyArray<LeadStatus> {
  return TRANSITIONS[current];
}

export function isValidTransition(
  from: LeadStatus,
  to: LeadStatus,
): boolean {
  if (from === to) return false;
  return TRANSITIONS[from].includes(to);
}

export function isTerminalStatus(status: LeadStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/**
 * For bulk status changes: returns the intersection of valid next statuses
 * across every selected lead. If the selection contains a terminal lead,
 * the result is empty.
 */
export function commonValidNextStatuses(
  currentStatuses: ReadonlyArray<LeadStatus>,
): ReadonlyArray<LeadStatus> {
  if (currentStatuses.length === 0) return [];
  if (currentStatuses.some(isTerminalStatus)) return [];

  // Start with all statuses and intersect.
  const sets = currentStatuses.map(
    (s) => new Set<LeadStatus>(getValidNextStatuses(s)),
  );
  const [first, ...rest] = sets;
  const intersection = new Set<LeadStatus>(first);
  for (const next of rest) {
    for (const s of intersection) {
      if (!next.has(s)) intersection.delete(s);
    }
  }
  return [...intersection];
}
