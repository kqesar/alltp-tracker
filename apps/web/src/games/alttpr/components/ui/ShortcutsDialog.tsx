import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import {
  ShortcutTable,
  type ShortcutTableHandle,
} from "@/games/alttpr/components/ui/ShortcutTable";
import {
  DEFAULT_KEYMAP,
  type Refusal,
  refusalOf,
} from "@/games/alttpr/data/keymap";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { altKey, commandKey } from "@/utils/platform";

/** Why a key was refused, for the status line. */
const refusalMessage = (refusal: Refusal, chord: string) =>
  refusal === "key"
    ? `${chord} can't be a shortcut: it keeps its own job. Pick another key.`
    : `${chord} belongs to the browser or the system. Pick a key alone, or with Shift or ${altKey()}.`;

/**
 * The keyboard shortcuts dialog: the master switch, the table of every grid
 * control with its keys (`ShortcutTable`) and Reset, which brings the
 * defaults back. The switch turns every shortcut off (WCAG 2.1.4). Each
 * change is announced in the status line.
 */
export const ShortcutsDialog = ({ onClose }: { onClose: () => void }) => {
  const shortcuts = useGameStore((state) => state.shortcuts);
  const setKeymap = useGameStore((state) => state.setKeymap);
  const setShortcutsEnabled = useGameStore(
    (state) => state.setShortcutsEnabled,
  );
  const table = useRef<ShortcutTableHandle>(null);

  const [isResetOpen, setIsResetOpen] = useState(false);
  const [status, setStatus] = useState("");

  // Escape cancels a capture in progress before it closes the dialog
  const handleClose = () => {
    if (!table.current?.cancelCapture()) onClose();
  };

  return (
    <>
      <Modal
        footer={
          <>
            <p
              className="shortcuts__status"
              data-testid="shortcuts-status"
              role="status"
            >
              {status}
            </p>
            <div className="shortcuts__actions">
              <button
                className="modal-btn modal-btn--ghost"
                data-testid="shortcuts-reset"
                onClick={() => setIsResetOpen(true)}
                type="button"
              >
                Reset to defaults
              </button>
              <button
                className="modal-btn modal-btn--primary"
                onClick={onClose}
                type="button"
              >
                Done
              </button>
            </div>
          </>
        }
        isOpen
        onClose={handleClose}
        title="Keyboard shortcuts"
        wide
      >
        <div className="shortcuts__intro">
          <button
            aria-checked={shortcuts.enabled}
            className="switch"
            data-testid="shortcuts-enabled"
            onClick={() => {
              setShortcutsEnabled(!shortcuts.enabled);
              setStatus(
                `Keyboard shortcuts ${shortcuts.enabled ? "off" : "on"}.`,
              );
            }}
            role="switch"
            type="button"
          >
            <span aria-hidden="true" className="switch__track" />
            Use keyboard shortcuts
          </button>
          <p className="shortcuts__hint">
            {shortcuts.enabled
              ? `While the tracker has focus, a key steps its control forward, as a click does, or back, as a right-click does. ${commandKey()}+Z undoes it.`
              : "Shortcuts are off: no key changes the board until they are back on."}
          </p>
        </div>

        <ShortcutTable
          keymap={shortcuts.keymap}
          onChange={setKeymap}
          onStatus={setStatus}
          ref={table}
          refusalMessage={refusalMessage}
          refusalOf={refusalOf}
        />
      </Modal>

      <ConfirmDialog
        confirmLabel="Reset"
        isOpen={isResetOpen}
        message="Every shortcut goes back to its default key; the ones you changed or removed are lost."
        onCancel={() => setIsResetOpen(false)}
        onConfirm={() => {
          setKeymap({ ...DEFAULT_KEYMAP });
          setIsResetOpen(false);
          setStatus("Every shortcut is back to its default.");
        }}
        title="Reset every shortcut?"
        tone="danger"
      />
    </>
  );
};
