import { useEffect, useRef, useState } from "react";
import type { Lead, LeadStatus } from "@/domain/lead";
import { STATUS_LABELS } from "@/domain/lead";
import {
  getValidNextStatuses,
  isTerminalStatus,
} from "@/domain/statusRules";
import { cn } from "@/utils/cn";
import { StatusBadge } from "./StatusBadge";

interface StatusMenuProps {
  lead: Lead;
  onChange: (next: LeadStatus) => void;
  /** Render as compact icon-button (table row) vs full button (toolbar). */
  variant?: "compact" | "default";
  disabled?: boolean;
}

/**
 * Dropdown that ONLY exposes valid next statuses for the current lead.
 * For terminal leads (CONVERTED / LOST) we show a locked state instead
 * of a clickable menu — that's what the spec means by "must be enforced
 * visually, not just guarded behind error toasts."
 */
export function StatusMenu({
  lead,
  onChange,
  variant = "default",
  disabled = false,
}: StatusMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const terminal = isTerminalStatus(lead.status);
  const next = getValidNextStatuses(lead.status);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (terminal) {
    return (
      <div
        className="inline-flex items-center gap-1.5"
        title={`${STATUS_LABELS[lead.status]} is a terminal status`}
      >
        <StatusBadge status={lead.status} />
        <span
          className="inline-flex h-5 w-5 items-center justify-center text-slate-400"
          aria-label="Locked"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 1a4 4 0 0 0-4 4v3H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1V5a4 4 0 0 0-4-4Zm2 7V5a2 2 0 1 0-4 0v3h4Z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </div>
    );
  }

  return (
    <div className="relative inline-block text-left">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          variant === "compact"
            ? "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs hover:bg-slate-100"
            : "btn-secondary",
        )}
      >
        <StatusBadge status={lead.status} />
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
      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-[12rem] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg animate-fade-in"
        >
          <div className="px-3 py-2 text-xs uppercase tracking-wide text-slate-500">
            Move to
          </div>
          {next.map((s) => (
            <button
              key={s}
              role="menuitem"
              type="button"
              onClick={() => {
                onChange(s);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              <StatusBadge status={s} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
