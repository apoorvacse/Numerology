import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "@/utils/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Controls dialog max-width. Defaults to a comfortable form size. */
  size?: "sm" | "md" | "lg";
  /** Disable Escape and overlay close — use for in-flight destructive ops. */
  dismissable?: boolean;
}

/**
 * Accessible modal primitive. We intentionally don't pull in Radix/HeadlessUI
 * for one dialog — the rules we need (focus trap, restore focus, escape-close,
 * scroll lock, aria labelledby/describedby) are about ~50 lines of code and
 * giving them a small home keeps the dependency tree tight.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  dismissable = true,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Save/restore focus around mount.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    // Defer: wait for content to render so first focusable is real.
    const t = setTimeout(() => {
      const first = dialogRef.current?.querySelector<HTMLElement>(
        '[data-autofocus="true"], input, button, textarea, select, [tabindex]:not([tabindex="-1"])',
      );
      first?.focus();
    }, 0);
    return () => {
      clearTimeout(t);
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape" && dismissable) {
        e.stopPropagation();
        onClose();
        return;
      }
      // Simple focus trap: keep Tab inside the dialog.
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [dismissable, onClose],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onKeyDown={handleKeyDown}
    >
      <div
        className="absolute inset-0 animate-fade-in bg-slate-900/50 backdrop-blur-sm"
        onClick={dismissable ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          "relative animate-scale-in rounded-xl bg-white shadow-2xl",
          size === "sm" && "w-full max-w-sm",
          size === "md" && "w-full max-w-lg",
          size === "lg" && "w-full max-w-2xl",
        )}
      >
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          {description && (
            <p id={descriptionId} className="mt-1 text-sm text-slate-600">
              {description}
            </p>
          )}
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 rounded-b-xl border-t border-slate-200 bg-slate-50 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
