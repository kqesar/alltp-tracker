import { RedoIcon, UndoIcon } from "@/components/ui/ToolbarIcons";
import { commandKey } from "@/utils/platform";

/**
 * The toolbar's Undo and Redo, the same for every game: icons named for a
 * screen reader, their shortcuts listed (`useUndoShortcuts` takes the keys).
 */
export const UndoRedoButtons = ({
  canRedo,
  canUndo,
  onRedo,
  onUndo,
}: {
  canRedo: boolean;
  canUndo: boolean;
  onRedo: () => void;
  onUndo: () => void;
}) => (
  <>
    <button
      aria-keyshortcuts="Control+Z Meta+Z"
      className="tracker-controls__button"
      data-testid="undo"
      disabled={!canUndo}
      onClick={onUndo}
      title={`Undo the last change (${commandKey()}+Z)`}
      type="button"
    >
      <UndoIcon />
      <span className="sr-only">Undo</span>
    </button>
    <button
      aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
      className="tracker-controls__button"
      data-testid="redo"
      disabled={!canRedo}
      onClick={onRedo}
      title={`Redo (${commandKey()}+Shift+Z)`}
      type="button"
    >
      <RedoIcon />
      <span className="sr-only">Redo</span>
    </button>
  </>
);
