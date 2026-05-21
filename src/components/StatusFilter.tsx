import { LEAD_STATUSES, STATUS_LABELS, type LeadStatus } from "@/domain/lead";
import { cn } from "@/utils/cn";

interface StatusFilterProps {
  selected: LeadStatus[];
  onToggle: (status: LeadStatus) => void;
  onClear: () => void;
}

/**
 * Pill-style toggle group. Multiple statuses can be active at once.
 * Rendered as <button> elements with aria-pressed for screen readers.
 */
export function StatusFilter({ selected, onToggle, onClear }: StatusFilterProps) {
  const selectedSet = new Set(selected);
  const hasAny = selected.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs font-medium uppercase tracking-wide text-slate-500">
        Status
      </span>
      {LEAD_STATUSES.map((s) => {
        const active = selectedSet.has(s);
        return (
          <button
            key={s}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(s)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              active
                ? "border-indigo-600 bg-indigo-600 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
            )}
          >
            {STATUS_LABELS[s]}
          </button>
        );
      })}
      {hasAny && (
        <button
          type="button"
          onClick={onClear}
          className="ml-1 text-xs text-slate-500 hover:text-slate-700"
        >
          Clear
        </button>
      )}
    </div>
  );
}
