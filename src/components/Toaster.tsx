import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/utils/cn";

/**
 * Tiny in-house toast system. We don't pull in react-hot-toast / sonner
 * because the surface needed is small and a local context keeps things
 * predictable. ARIA: rendered in a polite live region.
 */

type ToastVariant = "info" | "success" | "error";

interface Toast {
  id: number;
  message: string;
  description?: string;
  variant: ToastVariant;
  durationMs: number;
}

interface ToastContextValue {
  toast: (input: {
    message: string;
    description?: string;
    variant?: ToastVariant;
    durationMs?: number;
  }) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback<ToastContextValue["toast"]>((input) => {
    idRef.current += 1;
    const id = idRef.current;
    const t: Toast = {
      id,
      message: input.message,
      description: input.description,
      variant: input.variant ?? "info",
      durationMs: input.durationMs ?? 4000,
    };
    setToasts((prev) => [...prev, t]);
    return id;
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions text"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, toast.durationMs);
    return () => clearTimeout(t);
  }, [onDismiss, toast.durationMs]);

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto animate-slide-up rounded-lg border p-3 shadow-lg",
        toast.variant === "success" &&
          "border-emerald-200 bg-emerald-50 text-emerald-900",
        toast.variant === "error" &&
          "border-red-200 bg-red-50 text-red-900",
        toast.variant === "info" &&
          "border-slate-200 bg-white text-slate-900",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{toast.message}</p>
          {toast.description && (
            <p className="mt-0.5 text-xs opacity-80">{toast.description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="-m-1 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
