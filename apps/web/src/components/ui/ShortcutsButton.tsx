import { useState } from "react";
import { ShortcutsDialog } from "@/components/ui/ShortcutsDialog";
import { KeyboardIcon } from "@/components/ui/ToolbarIcons";
import { ToolbarMenuItem } from "@/components/ui/ToolbarMenu";

/**
 * The toolbar button that opens the keyboard shortcuts dialog. The dialog is
 * mounted only while open, so it costs nothing the rest of the time and
 * starts afresh each time.
 * @param variant - A toolbar button, or an item of the toolbar's More menu
 */
export const ShortcutsButton = ({
  variant = "toolbar",
}: {
  variant?: "toolbar" | "menu";
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {variant === "menu" ? (
        <ToolbarMenuItem
          icon={<KeyboardIcon />}
          label="Shortcuts"
          onSelect={() => setIsOpen(true)}
          testId="toolbar-more-shortcuts"
        />
      ) : (
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
      )}
      {isOpen && <ShortcutsDialog onClose={() => setIsOpen(false)} />}
    </>
  );
};
