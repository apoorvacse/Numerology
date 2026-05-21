import type { ListLeadsParams } from "./leads";

/**
 * Centralized React Query keys. Keeping them here means we can:
 *  - invalidate a known scope from a mutation without typo risk
 *  - easily refactor the cache shape later
 */
export const leadKeys = {
  all: ["leads"] as const,
  lists: () => [...leadKeys.all, "list"] as const,
  list: (params: ListLeadsParams) =>
    [...leadKeys.lists(), params] as const,
  detail: (id: string) => [...leadKeys.all, "detail", id] as const,
};
