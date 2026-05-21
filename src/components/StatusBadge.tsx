import type { LeadStatus } from "@/domain/lead";
import { STATUS_LABELS } from "@/domain/lead";
import { cn } from "@/utils/cn";

const STYLES: Record<LeadStatus, string> = {
  NEW: "bg-status-new-bg text-status-new-text ring-status-new-ring",
  CONTACTED: "bg-status-contacted-bg text-status-contacted-text ring-status-contacted-ring",
  QUALIFIED: "bg-status-qualified-bg text-status-qualified-text ring-status-qualified-ring",
  CONVERTED: "bg-status-converted-bg text-status-converted-text ring-status-converted-ring",
  LOST: "bg-status-lost-bg text-status-lost-text ring-status-lost-ring",
};

interface StatusBadgeProps {
  status: LeadStatus;
  size?: "sm" | "md";
  className?: string;
}

export function StatusBadge({ status, size = "sm", className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium ring-1 ring-inset",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        STYLES[status],
        className,
      )}
    >
      <span
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full",
          status === "NEW" && "bg-blue-500",
          status === "CONTACTED" && "bg-amber-500",
          status === "QUALIFIED" && "bg-violet-500",
          status === "CONVERTED" && "bg-emerald-500",
          status === "LOST" && "bg-red-500",
        )}
        aria-hidden="true"
      />
      {STATUS_LABELS[status]}
    </span>
  );
}
