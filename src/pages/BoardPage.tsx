import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useLeadsList, useUpdateLead } from "@/hooks/useLeads";
import { useViewState } from "@/hooks/useUrlState";
import {
  isValidTransition,
  isTerminalStatus,
} from "@/domain/statusRules";
import { LEAD_STATUSES, STATUS_LABELS, type Lead, type LeadStatus } from "@/domain/lead";
import { SearchBox } from "@/components/SearchBox";
import { StatusFilter } from "@/components/StatusFilter";
import { StatusBadge } from "@/components/StatusBadge";
import { Spinner } from "@/components/Spinner";
import { ErrorState } from "@/components/ErrorState";
import { useToast } from "@/components/Toaster";
import { cn } from "@/utils/cn";
import { formatRelativeTime } from "@/utils/format";

/**
 * Kanban board (Level 2). We chose @dnd-kit over react-beautiful-dnd
 * because rbd is no longer maintained and dnd-kit handles 50+ cards per
 * column smoothly with virtualization-friendly DOM. Sortable isn't needed
 * — we don't support reordering within a column — so we use the simpler
 * draggable + droppable primitives.
 *
 * Invalid drops are blocked at two layers:
 *  - The droppable column reports `data.canDrop === false` when the lead
 *    can't legally land there. The DragOverlay paints red feedback.
 *  - On drop, we re-check `isValidTransition` before any optimistic state
 *    change. If it fails we toast and return — no API call is made.
 */

const PAGE_SIZE = 250; // upper bound per column to keep DOM modest

export function BoardPage() {
  const view = useViewState();
  const debouncedQ = useDebouncedValue(view.q, 200);
  const { toast } = useToast();
  const updateMutation = useUpdateLead();

  const listParams = useMemo(
    () => ({
      q: debouncedQ || undefined,
      status: view.status.length > 0 ? view.status : undefined,
      page: 1,
      pageSize: 5000, // we want everything for the board view
    }),
    [debouncedQ, view.status],
  );

  const listQuery = useLeadsList(listParams);
  const items = listQuery.data?.items ?? [];

  const grouped = useMemo<Record<LeadStatus, Lead[]>>(() => {
    const acc: Record<LeadStatus, Lead[]> = {
      NEW: [],
      CONTACTED: [],
      QUALIFIED: [],
      CONVERTED: [],
      LOST: [],
    };
    for (const lead of items) acc[lead.status].push(lead);
    return acc;
  }, [items]);

  // ── DnD state ────────────────────────────────────────────────────────
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
  );

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    const lead = items.find((l) => l.id === id);
    if (lead) setActiveLead(lead);
  }

  async function onDragEnd(e: DragEndEvent) {
    const lead = activeLead;
    setActiveLead(null);
    if (!lead || !e.over) return;

    const target = String(e.over.id) as LeadStatus;
    if (target === lead.status) return;

    if (!isValidTransition(lead.status, target)) {
      toast({
        message: "Invalid status change",
        description: `${lead.name} can't move from ${STATUS_LABELS[lead.status]} to ${STATUS_LABELS[target]}.`,
        variant: "error",
      });
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: lead.id,
        input: { status: target },
      });
      toast({
        message: `Moved to ${STATUS_LABELS[target]}`,
        description: lead.name,
        variant: "success",
      });
    } catch (err) {
      toast({
        message: "Couldn't move lead",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "error",
      });
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Board</h2>
        <p className="text-sm text-slate-500">
          Drag a card to a valid next column. Locked columns won't accept
          drops.
        </p>
      </div>

      <div className="card flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchBox value={view.q} onChange={view.setQ} />
        <StatusFilter
          selected={view.status}
          onToggle={view.toggleStatus}
          onClear={() => view.setStatus([])}
        />
      </div>

      {listQuery.isLoading ? (
        <div className="card flex items-center justify-center gap-2 px-6 py-16 text-sm text-slate-500">
          <Spinner /> Loading board…
        </div>
      ) : listQuery.isError ? (
        <div className="card">
          <ErrorState
            message={
              listQuery.error instanceof Error
                ? listQuery.error.message
                : "Could not load board."
            }
            onRetry={() => listQuery.refetch()}
          />
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveLead(null)}
        >
          <div className="grid gap-3 lg:grid-cols-5 md:grid-cols-3 sm:grid-cols-2 grid-cols-1">
            {LEAD_STATUSES.map((status) => (
              <Column
                key={status}
                status={status}
                leads={grouped[status]}
                cap={PAGE_SIZE}
                activeLead={activeLead}
              />
            ))}
          </div>
          <DragOverlay>
            {activeLead ? <CardOverlay lead={activeLead} /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

// ─── Column ────────────────────────────────────────────────────────────

interface ColumnProps {
  status: LeadStatus;
  leads: Lead[];
  cap: number;
  activeLead: Lead | null;
}

function Column({ status, leads, cap, activeLead }: ColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id: status });

  const terminal = isTerminalStatus(status);
  // Check whether the active drag could land here. Used for visual feedback.
  const canAccept =
    activeLead && activeLead.status !== status
      ? isValidTransition(activeLead.status, status)
      : true;

  const showInvalidHover = isOver && activeLead && !canAccept;
  const showValidHover = isOver && activeLead && canAccept;

  const visible = leads.slice(0, cap);
  const overflow = leads.length - visible.length;

  return (
    <div
      className={cn(
        "flex h-[calc(100vh-300px)] min-h-[340px] flex-col rounded-xl border bg-slate-50/60 transition-colors",
        terminal && "border-dashed",
        showValidHover && "border-indigo-400 bg-indigo-50/60",
        showInvalidHover && "border-red-400 bg-red-50/40",
        !isOver && "border-slate-200",
      )}
    >
      <header className="flex items-center justify-between border-b border-slate-200/70 px-3 py-2">
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          <span className="text-xs text-slate-500">{leads.length}</span>
        </div>
        {terminal && (
          <span
            className="text-xs text-slate-400"
            title="Terminal status — cards here are locked"
          >
            locked
          </span>
        )}
      </header>

      <div ref={setNodeRef} className="relative flex-1 overflow-y-auto p-2">
        {visible.length === 0 && (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs text-slate-400">
            {terminal ? "No leads here." : "Drop a lead here."}
          </div>
        )}
        <div className="space-y-2">
          {visible.map((lead) => (
            <Card key={lead.id} lead={lead} />
          ))}
          {overflow > 0 && (
            <div className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-center text-xs text-slate-500">
              +{overflow} more — narrow with filters or search
            </div>
          )}
        </div>
        {showInvalidHover && (
          <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-lg bg-white/80 text-center text-xs font-medium text-red-700">
            Can't move {STATUS_LABELS[activeLead.status]} → {STATUS_LABELS[status]}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Card ──────────────────────────────────────────────────────────────

function Card({ lead }: { lead: Lead }) {
  const terminal = isTerminalStatus(lead.status);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    disabled: terminal,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "select-none rounded-md border border-slate-200 bg-white p-3 shadow-sm transition-shadow",
        terminal
          ? "cursor-not-allowed opacity-70"
          : "cursor-grab hover:shadow-md active:cursor-grabbing",
        isDragging && "opacity-30",
      )}
      aria-roledescription="draggable card"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">
            {lead.name}
          </p>
          <p className="truncate text-xs text-slate-500">{lead.email}</p>
        </div>
        {terminal && (
          <span
            className="text-slate-400"
            aria-label="Locked — terminal status"
            title="Terminal status"
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
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span className="truncate">{lead.source ?? "—"}</span>
        <span>{formatRelativeTime(lead.updated_at)}</span>
      </div>
    </div>
  );
}

function CardOverlay({ lead }: { lead: Lead }) {
  return (
    <div className="rotate-2 rounded-md border border-slate-300 bg-white p-3 shadow-xl">
      <p className="text-sm font-medium text-slate-900">{lead.name}</p>
      <p className="text-xs text-slate-500">{lead.email}</p>
    </div>
  );
}
