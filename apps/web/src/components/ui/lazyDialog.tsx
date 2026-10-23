import { type ComponentType, useState } from "react";
import { Modal } from "@/components/ui/Modal";

/** A dialog the toolbar opens. */
export type Dialog = ComponentType<{ onClose: () => void }>;

/**
 * How the page reloads. An object a test can spy on: `window.location` is
 * unforgeable, in jsdom as in a browser, so it cannot be replaced.
 */
export const page = { reload: () => window.location.reload() };

/** What the player is told when a dialog's code cannot be fetched. */
type Unavailable = {
  /** What the player asked for: the dialog's title */
  title: string;
  /** That it could not be loaded, and to reload: the run is saved */
  message: string;
};

/**
 * Shown when a dialog's code cannot be fetched: offline before it was ever
 * cached, or a release since this page loaded has replaced it.
 */
const DialogUnavailable = ({
  message,
  onClose,
  title,
}: Unavailable & { onClose: () => void }) => (
  <Modal
    footer={
      <>
        <button
          className="modal-btn modal-btn--ghost"
          onClick={onClose}
          type="button"
        >
          Close
        </button>
        <button
          className="modal-btn modal-btn--primary"
          data-autofocus
          onClick={() => page.reload()}
          type="button"
        >
          Reload
        </button>
      </>
    }
    isOpen
    onClose={onClose}
    title={title}
  >
    <p className="modal__message">{message}</p>
  </Modal>
);

/**
 * A dialog fetched once, on demand: a chunk of its own (the autotracking
 * guide's text, the shortcuts table), asked for as soon as a pointer or focus
 * reaches a control that opens it. A failed fetch is forgotten, for the next
 * try, and the player told so.
 * @param load - Imports the dialog's module and picks the dialog
 * @param unavailable - What the player is told when the fetch failed
 */
export const lazyDialog = (
  load: () => Promise<Dialog>,
  unavailable: Unavailable,
) => {
  const Unavailable: Dialog = ({ onClose }) => (
    <DialogUnavailable {...unavailable} onClose={onClose} />
  );
  let loading: Promise<Dialog> | undefined;
  /** The dialog, once its code has arrived. */
  let loaded: Dialog | undefined;

  const preload = () => {
    loading ??= load().then(
      (dialog) => {
        loaded = dialog;
        return dialog;
      },
      (error) => {
        loading = undefined;
        throw error;
      },
    );
    return loading;
  };

  return {
    /** For a control that opens it: fetch the code as the player comes near. */
    handlers: {
      onFocus: () => void preload().catch(() => {}),
      onPointerDown: () => void preload().catch(() => {}),
      onPointerEnter: () => void preload().catch(() => {}),
    },
    preload,
    /**
     * The dialog's state in a control: `open` shows it, once its code has
     * arrived; `shown` is the dialog to render, or nothing.
     */
    useDialog: () => {
      const [isOpen, setIsOpen] = useState(false);
      // Not React.lazy: a dialog whose code has arrived opens in the same
      // frame as the click
      const [dialog, setDialog] = useState<{ Component: Dialog } | null>(null);
      const open = () => {
        setIsOpen(true);
        if (loaded) {
          setDialog({ Component: loaded });
          return;
        }
        preload().then(
          (Component) => setDialog({ Component }),
          () => setDialog({ Component: Unavailable }),
        );
      };
      const Shown = isOpen ? dialog?.Component : undefined;
      return {
        open,
        shown: Shown && <Shown onClose={() => setIsOpen(false)} />,
      };
    },
  };
};
