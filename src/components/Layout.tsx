import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/utils/cn";
import { useToast } from "./Toaster";

/**
 * App shell. Persists across /leads and /board so search/filter URL state
 * carries over visually too. The nav links forward the search params so
 * filters survive navigation between views (Level 2 spec requirement).
 */
export function Layout() {
  const location = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  // Preserve current search params when switching tabs.
  const search = location.search;

  async function resetData() {
    try {
      await fetch("/api/_reset", { method: "POST" });
      qc.invalidateQueries();
      toast({
        message: "Reseeded mock data",
        description: "5,000 fresh leads loaded.",
        variant: "success",
      });
    } catch {
      toast({ message: "Reset failed", variant: "error" });
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
              L
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight text-slate-900">
                Lead CRM
              </h1>
              <p className="text-xs leading-tight text-slate-500">
                Superleap mini assessment
              </p>
            </div>
          </div>
          <nav aria-label="Primary" className="flex items-center gap-1">
            <NavTab to={`/leads${search}`} label="Leads" />
            <NavTab to={`/board${search}`} label="Board" />
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 text-xs text-slate-500 sm:px-6">
          <span>
            Mock API runs in-browser via MSW. Data persists to localStorage.
          </span>
          <button
            type="button"
            onClick={resetData}
            className="text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline"
            title="Reseed the mock with fresh data"
          >
            Reset data
          </button>
        </div>
      </footer>
    </div>
  );
}

function NavTab({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          isActive
            ? "bg-indigo-50 text-indigo-700"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        )
      }
      end={false}
    >
      {label}
    </NavLink>
  );
}
