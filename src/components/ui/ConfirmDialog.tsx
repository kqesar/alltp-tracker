import { Modal } from "@/components/ui/Modal";

type ConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" styles the confirm button for destructive actions */
  tone?: "default" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * A confirmation dialog built on Modal — replaces window.confirm with an
 * accessible, on-brand dialog.
 */
export const ConfirmDialog = ({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => (
  <Modal
    footer={
      <>
        <button
          className="modal-btn modal-btn--ghost"
          onClick={onCancel}
          type="button"
        >
          {cancelLabel}
        </button>
        <button
          className={`modal-btn ${tone === "danger" ? "modal-btn--danger" : "modal-btn--primary"}`}
          onClick={onConfirm}
          type="button"
        >
          {confirmLabel}
        </button>
      </>
    }
    isOpen={isOpen}
    onClose={onCancel}
    title={title}
  >
    <p className="modal__message">{message}</p>
  </Modal>
);
