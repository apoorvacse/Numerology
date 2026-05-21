import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="card">
      <div className="px-6 py-16 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
          404
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">
          Page not found
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          The route you tried doesn't exist.
        </p>
        <Link to="/leads" className="btn-primary mt-4 inline-flex">
          Back to leads
        </Link>
      </div>
    </div>
  );
}
