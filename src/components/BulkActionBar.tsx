import { useMemo, useState } from "react";
import type { Lead, LeadStatus } from "@/domain/lead";
import { STATUS_LABELS } from "@/domain/lead";
import { commonValidNextStatuses } from "@/domain/statusRules";
import { StatusBadge } from "./StatusBadge";

interface BulkActionBarProps {
  selected: Lead[];
  onClear: () => void;
  onBulkDelete: () => void;
  onBulkStatus: (status: LeadStatus) => void;
  isDeleting: boolean;
  isUpdating: boolean;
}

/**
 * The bulk action bar appears when one or more leads are selected.
 * Two design rules:
 *  1. Only show transitions that are valid for EVERY selected lead. If any
 *     selected lead is terminal (CONVERTED/LOST), no transitions show.
 *  2. When no transitions are possible, show a clear inline reason.
 */
export function BulkActionBar({
  selected,
  onClear,
  onBulkDelete,
  onBulkStatus,
  isDeleting,
  isUpdating,
}: BulkActionBarProps) {
  const [statusOpen, setStatusOpen] = useState(false);

  const validStatuses = useMemo(
    () => commonValidNextStatuses(selected.map((l) => l.status)),
    [selected],
  );

  const reason = useMemo(() => {
    if (selected.length === 0) return null;
    const terminal = selected.find(
      (l) => l.status === "CONVERTED" || l.status === "LOST",
    );
    if (terminal) {
      return `Selection includes a ${STATUS_LABELS[terminal.status]} lead — no transitions allowed.`;
    }
    if (validStatuses.length === 0) {
      return "Selected leads have no common next status.";
    }
    return null;
  }, [selected, validStatuses]);

  if (selected.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="sticky bottom-4 z-30 mx-auto flex w-full max-w-3xl animate-slide-up items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-lg"
    >
      <span className="text-sm font-medium text-slate-700">
        {selected.length} selected
      </span>

      <div className="relative">
        <button
          type="button"
          className="btn-secondary"
          disabled={validStatuses.length === 0 || isUpdating}
          onClick={() => setStatusOpen((o) => !o)}
          title={reason ?? undefined}
          aria-haspopup="menu"
          aria-expanded={statusOpen}
        >
          Change status
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-3.5 w-3.5 text-slate-400"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.06l3.71-3.83a.75.75 0 1 1 1.08 1.04l-4.25 4.39a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        {statusOpen && validStatuses.length > 0 && (
          <div
            role="menu"
            className="absolute bottom-full left-0 z-10 mb-1 min-w-[12rem] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg animate-fade-in"
          >
            <div className="px-3 py-2 text-xs uppercase tracking-wide text-slate-500">
              Move all to
            </div>
            {validStatuses.map((s) => (
              <button
                key={s}
                role="menuitem"
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  setStatusOpen(false);
                  onBulkStatus(s);
                }}
              >
                <StatusBadge status={s} />
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        className="btn-danger"
        onClick={onBulkDelete}
        disabled={isDeleting}
      >
        Delete
      </button>

      {reason && (
        <span className="hidden truncate text-xs text-slate-500 sm:inline">
          {reason}
        </span>
      )}

      <div className="ml-auto">
        <button
          type="button"
          className="btn-ghost"
          onClick={onClear}
          aria-label="Clear selection"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
