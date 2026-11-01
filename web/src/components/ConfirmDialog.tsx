import { Loader2 } from "lucide-react";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  danger?: boolean;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  busy = false,
  danger = true,
}: ConfirmDialogProps): React.JSX.Element {
  return (
    <Modal title={title} onClose={busy ? () => undefined : onCancel} className="modal-small">
      <p className="modal-copy">{description}</p>
      <div className="modal-actions">
        <button type="button" className="button button-ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className={`button ${danger ? "button-danger" : "button-primary"}`}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? <Loader2 size={15} className="spin" /> : null}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}