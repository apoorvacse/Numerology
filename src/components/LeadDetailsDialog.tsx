import type { Lead } from "@/domain/lead";
import { formatDateTime, formatRelativeTime } from "@/utils/format";
import { Modal } from "./Modal";
import { StatusBadge } from "./StatusBadge";

interface LeadDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  lead: Lead | null;
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
}

/**
 * Read-only "View" presentation. Distinct from the edit form so a quick
 * peek at all fields (including phone / created_at / id) doesn't put the
 * record at risk of accidental edits.
 */
export function LeadDetailsDialog({
  open,
  onClose,
  lead,
  onEdit,
  onDelete,
}: LeadDetailsDialogProps) {
  if (!lead) return null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={lead.name}
      description={lead.email}
      footer={
        <>
          <button
            type="button"
            className="btn-danger mr-auto"
            onClick={() => onDelete(lead)}
          >
            Delete
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => onEdit(lead)}
          >
            Edit
          </button>
        </>
      }
    >
      <dl className="grid grid-cols-3 gap-x-4 gap-y-3 text-sm">
        <Row label="Status">
          <StatusBadge status={lead.status} />
        </Row>
        <Row label="Phone">
          {lead.phone ?? <span className="text-slate-400">Not provided</span>}
        </Row>
        <Row label="Source">
          {lead.source ?? <span className="text-slate-400">Not provided</span>}
        </Row>
        <Row label="Created">
          <span title={lead.created_at}>{formatDateTime(lead.created_at)}</span>
        </Row>
        <Row label="Updated">
          <span title={lead.updated_at}>
            {formatDateTime(lead.updated_at)}{" "}
            <span className="text-slate-400">
              ({formatRelativeTime(lead.updated_at)})
            </span>
          </span>
        </Row>
        <Row label="ID">
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
            {lead.id}
          </code>
        </Row>
      </dl>
    </Modal>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="col-span-1 text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="col-span-2 text-slate-900">{children}</dd>
    </>
  );
}
