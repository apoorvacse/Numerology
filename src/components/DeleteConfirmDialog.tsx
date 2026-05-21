import { Modal } from "./Modal";
import { Spinner } from "./Spinner";

interface DeleteConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  isPending?: boolean;
}

/**
 * Generic destructive-action confirmation. We require a deliberate click
 * to confirm — never a double-click or single-click delete in the row.
 * The optimistic removal happens in the mutation; this is just the gate.
 */
export function DeleteConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Delete this lead?",
  message = "This action can't be undone.",
  confirmLabel = "Delete",
  isPending = false,
}: DeleteConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={message}
      size="sm"
      dismissable={!isPending}
      footer={
        <>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending && <Spinner size={14} />}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div />
    </Modal>
  );
}
