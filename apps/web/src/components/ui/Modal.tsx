import { type ReactNode, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

type ModalProps = {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Called when the user dismisses the modal (Esc, backdrop, close button) */
  onClose: () => void;
  /** Accessible dialog title */
  title: string;
  /** Dialog body */
  children: ReactNode;
  /** Optional footer (e.g. action buttons) */
  footer?: ReactNode;
  /**
   * A wide dialog for long content: the body scrolls between a header and a
   * footer that stay in view.
   */
  wide?: boolean;
};

/**
 * A modal dialog on the native `<dialog>` element. `showModal()` gives the
 * focus trap, the inert page behind and the backdrop; Escape fires `cancel`
 * on the topmost dialog only, so a confirmation stacked over a list closes on
 * its own. Focus returns to whatever opened the dialog.
 */
export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  wide = false,
}: ModalProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // Read the latest onClose without re-running the open effect: callers pass
  // inline callbacks, and re-opening on every render would steal focus.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) return;

    const opener = document.activeElement as HTMLElement | null;
    dialog.showModal();
    // showModal() focuses the first focusable element, the close button; a
    // dialog can name a better starting point with data-autofocus.
    dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => {
      dialog.close();
      opener?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    // The dialog's own box is the backdrop's hit area: its content fills the
    // inner surface, so a click whose target is the dialog landed outside it.
    // Keyboard users dismiss with Escape (the `cancel` event) instead.
    <dialog
      aria-labelledby={titleId}
      className={wide ? "modal modal--wide" : "modal"}
      onCancel={(event) => {
        event.preventDefault();
        // A dialog rendered inside another's React tree (a portal) must not
        // close its parent: Escape belongs to the topmost one
        event.stopPropagation();
        onCloseRef.current();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current();
      }}
      ref={dialogRef}
    >
      <div className="modal__surface">
        <header className="modal__header">
          <h2 className="modal__title" id={titleId}>
            {title}
          </h2>
          <button
            aria-label="Close dialog"
            className="modal__close"
            onClick={() => onCloseRef.current()}
            type="button"
          >
            ×
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__footer">{footer}</footer>}
      </div>
    </dialog>,
    document.body,
  );
};
