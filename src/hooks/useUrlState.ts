import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { LEAD_STATUSES, type LeadStatus } from "@/domain/lead";

/**
 * Single source of truth for the filterable view state — search query,
 * status filter, sort. Encoded in the URL so a filtered view is shareable
 * and survives refreshes. Both /leads and /board read from the same hook,
 * which is what makes filters "persist between views" (Level 2).
 */

export type SortKey = "updated_at" | "created_at" | "name";
export type SortOrder = "asc" | "desc";

export interface ViewState {
  q: string;
  status: LeadStatus[];
  sort: SortKey;
  order: SortOrder;
}

const VALID_SORTS: ReadonlyArray<SortKey> = [
  "updated_at",
  "created_at",
  "name",
];

function parseStatuses(raw: string | null): LeadStatus[] {
  if (!raw) return [];
  const set = new Set(LEAD_STATUSES as ReadonlyArray<string>);
  return raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s): s is LeadStatus => set.has(s));
}

function parseSort(raw: string | null): SortKey {
  if (raw && VALID_SORTS.includes(raw as SortKey)) return raw as SortKey;
  return "updated_at";
}

function parseOrder(raw: string | null): SortOrder {
  return raw === "asc" ? "asc" : "desc";
}

export function useViewState(): ViewState & {
  setQ: (q: string) => void;
  setStatus: (status: LeadStatus[]) => void;
  setSort: (sort: SortKey, order?: SortOrder) => void;
  toggleStatus: (status: LeadStatus) => void;
  reset: () => void;
} {
  const [params, setParams] = useSearchParams();

  const state = useMemo<ViewState>(
    () => ({
      q: params.get("q") ?? "",
      status: parseStatuses(params.get("status")),
      sort: parseSort(params.get("sort")),
      order: parseOrder(params.get("order")),
    }),
    [params],
  );

  const update = useCallback(
    (patch: Partial<ViewState>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (patch.q !== undefined) {
            if (patch.q) next.set("q", patch.q);
            else next.delete("q");
          }
          if (patch.status !== undefined) {
            if (patch.status.length > 0)
              next.set("status", patch.status.join(","));
            else next.delete("status");
          }
          if (patch.sort !== undefined) {
            if (patch.sort !== "updated_at") next.set("sort", patch.sort);
            else next.delete("sort");
          }
          if (patch.order !== undefined) {
            if (patch.order !== "desc") next.set("order", patch.order);
            else next.delete("order");
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return {
    ...state,
    setQ: (q) => update({ q }),
    setStatus: (status) => update({ status }),
    setSort: (sort, order) => update({ sort, order: order ?? state.order }),
    toggleStatus: (s) => {
      const set = new Set(state.status);
      if (set.has(s)) set.delete(s);
      else set.add(s);
      update({ status: [...set] });
    },
    reset: () => update({ q: "", status: [], sort: "updated_at", order: "desc" }),
  };
}
