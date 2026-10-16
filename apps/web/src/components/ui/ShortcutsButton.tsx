import { type ComponentType, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { KeyboardIcon } from "@/components/ui/ToolbarIcons";
import { ToolbarMenuItem } from "@/components/ui/ToolbarMenu";

type Dialog = ComponentType<{ onClose: () => void }>;

let loading: Promise<Dialog> | undefined;

/** The dialog, once its code has arrived. */
let loaded: Dialog | undefined;

/**
 * Fetch the shortcuts dialog's code, once: it is a chunk of its own, asked
 * for when the page is idle or as soon as the pointer or focus reaches a
 * control that opens it, so it is there by the click. A failed fetch is
 * forgotten, for the next try.
 */
export const preloadShortcutsDialog = () => {
  loading ??= import("@/components/ui/ShortcutsDialog").then(
    (module) => {
      loaded = module.ShortcutsDialog;
      return loaded;
    },
    (error) => {
      loading = undefined;
      throw error;
    },
  );
  return loading;
};

/**
 * Shown when the dialog's code cannot be fetched: offline, or a deploy since
 * this page loaded has replaced it. A reload brings the current version.
 */
const ShortcutsUnavailable = ({ onClose }: { onClose: () => void }) => (
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
          onClick={() => window.location.reload()}
          type="button"
        >
          Reload
        </button>
      </>
    }
    isOpen
    onClose={onClose}
    title="Keyboard shortcuts"
  >
    <p className="modal__message">
      The shortcuts settings could not be loaded. Reload the page to try again;
      your run is saved.
    </p>
  </Modal>
);

/** How long to wait for an idle moment before fetching the dialog anyway. */
const IDLE_TIMEOUT_MS = 3000;

/**
 * Fetch the dialog once the page is idle, off the first render's path: a tap
 * on a phone gives no hover to start it early, and on a slow network the
 * chunk would otherwise arrive after the tap.
 */
const usePrefetchWhenIdle = () => {
  useEffect(() => {
    const prefetch = () => void preloadShortcutsDialog().catch(() => {});
    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(prefetch, {
        timeout: IDLE_TIMEOUT_MS,
      });
      return () => window.cancelIdleCallback(handle);
    }
    // Safari has no requestIdleCallback
    const timer = setTimeout(prefetch, IDLE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);
};

/** Start fetching the dialog when a pointer or keyboard focus gets close. */
const preload = {
  onFocus: () => void preloadShortcutsDialog().catch(() => {}),
  onPointerDown: () => void preloadShortcutsDialog().catch(() => {}),
  onPointerEnter: () => void preloadShortcutsDialog().catch(() => {}),
};

/**
 * The toolbar button that opens the keyboard shortcuts dialog. The dialog is
 * mounted only while open, so it costs nothing the rest of the time and
 * starts afresh each time. Its code is a chunk of its own, fetched once the
 * page is idle, or sooner when a pointer or focus reaches the button.
 * @param variant - A toolbar button, or an item of the toolbar's More menu
 */
export const ShortcutsButton = ({
  variant = "toolbar",
}: {
  variant?: "toolbar" | "menu";
}) => {
  const [isOpen, setIsOpen] = useState(false);
  // Not React.lazy: a lazy component suspends even when its code is already
  // there, and React holds a revealed Suspense boundary back for 300 ms. A
  // dialog whose code has arrived opens in the same frame as the click.
  const [dialog, setDialog] = useState<{ Component: Dialog } | null>(null);
  usePrefetchWhenIdle();

  const open = () => {
    setIsOpen(true);
    if (loaded) {
      setDialog({ Component: loaded });
      return;
    }
    preloadShortcutsDialog().then(
      (Component) => setDialog({ Component }),
      () => setDialog({ Component: ShortcutsUnavailable }),
    );
  };
  const Shown = isOpen ? dialog?.Component : undefined;

  return (
    <>
      {variant === "menu" ? (
        <ToolbarMenuItem
          {...preload}
          icon={<KeyboardIcon />}
          label="Shortcuts"
          onSelect={open}
          testId="toolbar-more-shortcuts"
        />
      ) : (
        <button
          {...preload}
          className="tracker-controls__button"
          data-testid="shortcuts-button"
          onClick={open}
          title="Keyboard shortcuts"
          type="button"
        >
          <KeyboardIcon />
          <span className="toolbar-label">Shortcuts</span>
        </button>
      )}
      {Shown && <Shown onClose={() => setIsOpen(false)} />}
    </>
  );
};
