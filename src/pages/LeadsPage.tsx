import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Lead, LeadStatus } from "@/domain/lead";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  useBulkDelete,
  useBulkUpdateStatus,
  useDeleteLead,
  useLeadsList,
  useUpdateLead,
} from "@/hooks/useLeads";
import { useViewState } from "@/hooks/useUrlState";
import { SearchBox } from "@/components/SearchBox";
import { StatusFilter } from "@/components/StatusFilter";
import { LeadTable } from "@/components/LeadTable";
import { LeadFormDialog } from "@/components/LeadFormDialog";
import { LeadDetailsDialog } from "@/components/LeadDetailsDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { BulkActionBar } from "@/components/BulkActionBar";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Spinner } from "@/components/Spinner";
import { useToast } from "@/components/Toaster";

/**
 * The list view ties everything together: URL-synced filters/search,
 * the virtualized table, mutations with toasts, and the create/edit/delete
 * flows. The /:id/edit deep link is handled by reading the route param,
 * fetching from the cache (or fresh), and opening the dialog.
 */
export function LeadsPage() {
  const navigate = useNavigate();
  const params = useParams<{ id?: string; mode?: string }>();
  const view = useViewState();
  const { toast } = useToast();

  // Debounce the URL-synced search term so we don't refetch on every keystroke.
  // The SearchBox itself debounces local→URL; this is the URL→fetch debounce.
  const debouncedQ = useDebouncedValue(view.q, 200);

  const listParams = useMemo(
    () => ({
      q: debouncedQ || undefined,
      status: view.status.length > 0 ? view.status : undefined,
      sort: view.sort,
      order: view.order,
    }),
    [debouncedQ, view.status, view.sort, view.order],
  );

  const listQuery = useLeadsList(listParams);
  const items: Lead[] = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;

  // ── Selection ────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Clear selection when the underlying list changes meaningfully.
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const visible = new Set(items.map((l) => l.id));
      const next = new Set<string>();
      for (const id of prev) if (visible.has(id)) next.add(id);
      return next.size === prev.size ? prev : next;
    });
  }, [items]);

  const selectedLeads = useMemo(
    () => items.filter((l) => selectedIds.has(l.id)),
    [items, selectedIds],
  );

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const allVisibleSelected = items.every((l) => prev.has(l.id));
      if (allVisibleSelected) return new Set();
      return new Set(items.map((l) => l.id));
    });
  }
  function clearSelection() {
    setSelectedIds(new Set());
  }

  // ── Create / Edit / View dialog ──────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [formLead, setFormLead] = useState<Lead | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLead, setDetailsLead] = useState<Lead | null>(null);

  // Drive dialogs from the route. Two routes:
  //   /leads/:id          → details (View)
  //   /leads/:id/edit     → form    (Edit)
  // Refreshing either URL still works because we read from the loaded list.
  useEffect(() => {
    if (!params.id) {
      setFormOpen(false);
      setDetailsOpen(false);
      return;
    }
    const lead = items.find((l) => l.id === params.id) ?? null;
    if (!lead) {
      // Not in the cache yet. If loading is done and still missing, redirect.
      if (!listQuery.isLoading && items.length > 0) {
        toast({ message: "Lead not found", variant: "error" });
        navigate("/leads", { replace: true });
      }
      return;
    }
    if (params.mode === "edit") {
      setFormLead(lead);
      setFormOpen(true);
      setDetailsOpen(false);
    } else {
      setDetailsLead(lead);
      setDetailsOpen(true);
      setFormOpen(false);
    }
    // We deliberately exclude `items` to avoid reopening on every refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, params.mode, listQuery.isLoading]);

  function openCreate() {
    setFormLead(null);
    setFormOpen(true);
  }
  function openView(lead: Lead) {
    navigate(`/leads/${lead.id}`);
  }
  function openEdit(lead: Lead) {
    navigate(`/leads/${lead.id}/edit`);
  }
  function closeForm() {
    setFormOpen(false);
    setFormLead(null);
    if (params.id) navigate("/leads", { replace: true });
  }
  function closeDetails() {
    setDetailsOpen(false);
    setDetailsLead(null);
    if (params.id) navigate("/leads", { replace: true });
  }

  // ── Delete (single) ──────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const deleteMutation = useDeleteLead();

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteMutation.mutateAsync(target.id);
      toast({
        message: "Lead deleted",
        description: target.name,
        variant: "success",
      });
    } catch (err) {
      toast({
        message: "Couldn't delete lead",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "error",
      });
    }
  }

  // ── Status change (single) ───────────────────────────────────────────
  const updateMutation = useUpdateLead();
  async function changeStatus(lead: Lead, next: LeadStatus) {
    try {
      await updateMutation.mutateAsync({
        id: lead.id,
        input: { status: next },
      });
      toast({
        message: `Moved to ${next}`,
        description: lead.name,
        variant: "success",
      });
    } catch (err) {
      toast({
        message: "Couldn't change status",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "error",
      });
    }
  }

  // ── Bulk actions ─────────────────────────────────────────────────────
  const bulkDelete = useBulkDelete();
  const bulkStatus = useBulkUpdateStatus();
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  async function runBulkDelete() {
    const ids = [...selectedIds];
    setBulkDeleteOpen(false);
    const result = await bulkDelete.mutateAsync(ids);
    clearSelection();
    if (result.failed.length === 0) {
      toast({
        message: `Deleted ${result.succeeded.length} lead${result.succeeded.length === 1 ? "" : "s"}`,
        variant: "success",
      });
    } else {
      toast({
        message: `Deleted ${result.succeeded.length}, ${result.failed.length} failed`,
        description: result.failed
          .slice(0, 3)
          .map((f) => f.reason)
          .join("; "),
        variant: "error",
        durationMs: 6000,
      });
    }
  }

  async function runBulkStatus(status: LeadStatus) {
    const ids = [...selectedIds];
    const result = await bulkStatus.mutateAsync({ ids, status });
    clearSelection();
    if (result.failed.length === 0) {
      toast({
        message: `Moved ${result.succeeded.length} to ${status}`,
        variant: "success",
      });
    } else {
      toast({
        message: `Updated ${result.succeeded.length}, ${result.failed.length} failed`,
        description: result.failed
          .slice(0, 3)
          .map((f) => f.reason)
          .join("; "),
        variant: "error",
        durationMs: 6000,
      });
    }
  }

  // ── Render ───────────────────────────────────────────────────────────
  const showLoading = listQuery.isLoading;
  const showError = listQuery.isError;
  const showEmpty =
    !showLoading && !showError && listQuery.isFetched && items.length === 0;
  const hasFilters = view.q.length > 0 || view.status.length > 0;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Leads</h2>
          <p className="text-sm text-slate-500">
            {showLoading
              ? "Loading…"
              : `${total.toLocaleString()} ${total === 1 ? "lead" : "leads"}${hasFilters ? " match" : " total"}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-primary"
            onClick={openCreate}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
            New lead
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchBox
          value={view.q}
          onChange={view.setQ}
          placeholder="Search by name or email…"
        />
        <StatusFilter
          selected={view.status}
          onToggle={view.toggleStatus}
          onClear={() => view.setStatus([])}
        />
      </div>

      {/* Body */}
      {showLoading && (
        <div className="card flex items-center justify-center gap-2 px-6 py-16 text-sm text-slate-500">
          <Spinner /> Loading leads…
        </div>
      )}
      {showError && (
        <div className="card">
          <ErrorState
            message={
              listQuery.error instanceof Error
                ? listQuery.error.message
                : "Could not load leads."
            }
            onRetry={() => listQuery.refetch()}
          />
        </div>
      )}
      {showEmpty && (
        <div className="card">
          <EmptyState
            title={hasFilters ? "No leads match your filters" : "No leads yet"}
            description={
              hasFilters
                ? "Try clearing filters or adjusting the search query."
                : "Create your first lead to get started."
            }
            action={
              hasFilters ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={view.reset}
                >
                  Clear filters
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={openCreate}
                >
                  New lead
                </button>
              )
            }
          />
        </div>
      )}
      {!showLoading && !showError && items.length > 0 && (
        <>
          <LeadTable
            leads={items}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAllVisible}
            onView={openView}
            onEdit={openEdit}
            onDelete={(l) => setDeleteTarget(l)}
            onStatusChange={changeStatus}
          />
          {listQuery.isFetching && (
            <p className="flex items-center justify-end gap-1.5 px-1 text-xs text-slate-500">
              <Spinner size={12} /> Refreshing…
            </p>
          )}
        </>
      )}

      <BulkActionBar
        selected={selectedLeads}
        onClear={clearSelection}
        onBulkDelete={() => setBulkDeleteOpen(true)}
        onBulkStatus={runBulkStatus}
        isDeleting={bulkDelete.isPending}
        isUpdating={bulkStatus.isPending}
      />

      {/* Dialogs */}
      <LeadFormDialog
        open={formOpen}
        lead={formLead}
        onClose={closeForm}
      />
      <LeadDetailsDialog
        open={detailsOpen}
        lead={detailsLead}
        onClose={closeDetails}
        onEdit={(l) => navigate(`/leads/${l.id}/edit`)}
        onDelete={(l) => {
          setDeleteTarget(l);
          closeDetails();
        }}
      />
      <DeleteConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete this lead?"
        message={
          deleteTarget
            ? `${deleteTarget.name} (${deleteTarget.email}) will be permanently removed.`
            : ""
        }
        isPending={deleteMutation.isPending}
      />
      <DeleteConfirmDialog
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={runBulkDelete}
        title={`Delete ${selectedIds.size} leads?`}
        message="This action can't be undone. Each lead will be deleted individually; if any deletions fail, you'll see a summary."
        confirmLabel={`Delete ${selectedIds.size}`}
        isPending={bulkDelete.isPending}
      />
    </div>
  );
}
