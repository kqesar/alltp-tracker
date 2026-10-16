import { useState } from "react";
import { ShortcutsDialog } from "@/components/ui/ShortcutsDialog";
import { KeyboardIcon } from "@/components/ui/ToolbarIcons";

/**
 * The toolbar button that opens the keyboard shortcuts dialog. The dialog is
 * mounted only while open, so it costs nothing the rest of the time and
 * starts afresh each time.
 */
export const ShortcutsButton = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className="tracker-controls__button"
        data-testid="shortcuts-button"
        onClick={() => setIsOpen(true)}
        title="Keyboard shortcuts"
        type="button"
      >
        <KeyboardIcon />
        <span className="toolbar-label">Shortcuts</span>
      </button>
      {isOpen && <ShortcutsDialog onClose={() => setIsOpen(false)} />}
    </>
  );
};
