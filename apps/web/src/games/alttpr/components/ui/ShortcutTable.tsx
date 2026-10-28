import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type Ref,
  useEffect,
  useId,
  useImperativeHandle,
  useState,
} from "react";
import { Modal } from "@/components/ui/Modal";
import { KeyChord } from "@/games/alttpr/components/ui/KeyChord";
import { BOSS_STATES } from "@/games/alttpr/constants";
import {
  items,
  itemsMax,
  itemsMin,
  TOGGLE_ITEMS,
} from "@/games/alttpr/data/items";
import {
  type ActionId,
  bind,
  type Chord,
  type ControlId,
  chordOf,
  conflictOf,
  controlName,
  controlTitle,
  dungeonControls,
  ITEM_CONTROLS,
  type Keymap,
  parseAction,
  type Resolution,
  type ShortcutDirection,
  unbind,
} from "@/games/alttpr/data/keymap";
import { wildItems } from "@/games/alttpr/data/presets";
import { dungeonName, KEY_DUNGEONS } from "@/games/alttpr/logic/settings";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { useKeyboardLayout } from "@/games/alttpr/stores/keyboardLayoutStore";
import { getAssetPath } from "@/games/alttpr/utils";
import { chordText } from "@/games/alttpr/utils/keyLabels";

const DIRECTIONS: ShortcutDirection[] = ["advance", "back"];

/** How the table names each direction, matching its column headers. */
const DIRECTION_NAMES: Record<ShortcutDirection, string> = {
  advance: "forward",
  back: "back",
};

/** The art a control is listed with: an item as found, a dungeon control at rest. */
const iconOf = (control: ControlId): string => {
  // The castle dungeons' too: Hyrule Castle's map10 to Ganon's Tower's 12
  const kind = /^(bigkey|smallkey|map|compass|medallion|reward)\d+$/.exec(
    control,
  )?.[1];
  if (kind === "bigkey" || kind === "smallkey" || kind === "compass") {
    return `${kind}.png`;
  }
  if (kind === "map") return "dungeonmap.png";
  if (kind === "medallion") return "medallion0.png";
  if (kind === "reward") return "dungeon0.png";
  // Link's hearts: the counter's full heart, no level of their own
  if (control === "hearts") return "heart.png";
  // Agahnim 2, atop Ganon's Tower, is drawn as Agahnim, as on the board
  if (control === "agahnim2") return "agahnim1.png";

  const value = items[control];
  if (typeof value === "boolean" || TOGGLE_ITEMS.has(control)) {
    return `${control}.png`;
  }
  // A dungeon's chests all there: their starting art; a boss has one
  // portrait, which the board greys while it is alive
  if (control.startsWith("chest")) return `chest${value}.png`;
  if (control.startsWith("boss")) return `${control}${BOSS_STATES.BEATEN}.png`;
  return `${control}${Math.min(itemsMin[control] + 1, itemsMax[control])}.png`;
};

/** A binding waiting for the player to say what happens to the key's holder. */
type Conflict = { action: ActionId; chord: Chord; holder: ActionId };

/** What the dialog asks of the table when Escape is pressed. */
export type ShortcutTableHandle = {
  /** Ends a capture in progress; false when there was none */
  cancelCapture: () => boolean;
};

/**
 * Every grid control with its forward and back keys, over any keymap.
 * Activating a key starts a capture: the next key pressed becomes the
 * shortcut, Delete or Backspace removes it, Escape (or leaving the button)
 * cancels. A key already in use asks whether to swap or replace. Each change
 * goes to `onChange`, and its words to `onStatus`, for the caller's status
 * line.
 * @param refusalOf - Why a chord cannot be bound here, or null
 * @param refusalMessage - The words for a refusal, given the chord's label
 * and the chord itself
 * @param rowExtra - What to show under an action's key, if anything
 * @param noteId - The id of the element in `rowExtra` that explains an
 * action's key, which the key button is then described by (screen readers
 * read it with the key)
 * @param onCapturingChange - Told when a key capture starts and ends
 */
export const ShortcutTable = <Refusal extends string>({
  keymap,
  onCapturingChange,
  onChange,
  onStatus,
  ref,
  refusalMessage,
  refusalOf,
  noteId,
  rowExtra,
}: {
  keymap: Keymap;
  onCapturingChange?: (capturing: boolean) => void;
  onChange: (next: Keymap) => void;
  onStatus: (message: string) => void;
  ref?: Ref<ShortcutTableHandle>;
  refusalMessage: (refusal: Refusal, label: string, chord: Chord) => string;
  refusalOf: (chord: Chord) => Refusal | null;
  noteId?: (action: ActionId) => string | undefined;
  rowExtra?: (action: ActionId) => ReactNode;
}) => {
  const bigKeysVisible = useGameStore((state) => state.bigKeysVisible);
  const withMaps = useGameStore(
    (state) => wildItems(state.settings).mapsAndCompasses,
  );
  const layout = useKeyboardLayout();
  const itemsHeading = useId();
  const dungeonsHeading = useId();

  const [capturing, setCapturing] = useState<ActionId | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);

  useEffect(() => {
    onCapturingChange?.(capturing !== null);
  }, [capturing, onCapturingChange]);

  const text = (chord: Chord) => chordText(chord, layout);
  const describe = (action: ActionId) => {
    const { control, direction } = parseAction(action);
    return `${controlTitle(control)} ${DIRECTION_NAMES[direction]}`;
  };
  const bindingOf = (action: ActionId, map: Keymap) => {
    const chord = map[action];
    return `${describe(action)}: ${chord ? text(chord) : "no shortcut"}`;
  };
  // Which key cell shortcuts wait: the cells hidden, or the map and compass
  // while they stay in their dungeons, where the cells do not show them
  const keyCellsHint = !bigKeysVisible
    ? withMaps
      ? "Key, map and compass shortcuts work while the key cells are shown."
      : "Key shortcuts work while the key cells are shown, map and compass ones when maps and compasses are shuffled."
    : withMaps
      ? null
      : "Map and compass shortcuts work when maps and compasses are shuffled.";
  const unchanged = (action: ActionId) =>
    `Change cancelled. ${bindingOf(action, keymap)}.`;

  const startCapture = (action: ActionId) => {
    setCapturing(action);
    onStatus(
      `Press the new key for ${describe(action)}. Delete removes it, Escape cancels.`,
    );
  };

  const stopCapture = (message: string) => {
    setCapturing(null);
    onStatus(message);
  };

  // Escape cancels a capture in progress before it closes the dialog
  useImperativeHandle(ref, () => ({
    cancelCapture: () => {
      if (!capturing) return false;
      stopCapture(unchanged(capturing));
      return true;
    },
  }));

  const assign = (action: ActionId, chord: Chord, resolution?: Resolution) => {
    const holder = conflictOf(keymap, action, chord);
    const next = bind(keymap, action, chord, resolution);
    onChange(next);
    onStatus(
      [action, ...(holder ? [holder] : [])]
        .map((changed) => `${bindingOf(changed, next)}.`)
        .join(" "),
    );
  };

  const onCaptureKeyDown =
    (action: ActionId) => (event: KeyboardEvent<HTMLButtonElement>) => {
      // Tab moves on, and leaving the button ends the capture. Escape is the
      // dialog's: its cancel event ends the capture (see cancelCapture).
      if (event.key === "Tab" || event.key === "Escape") return;
      // The key is the capture's: Enter and Space must not click the button
      event.preventDefault();
      const native = event.nativeEvent;
      if (native.isComposing || native.repeat) return;

      const bare = !(
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      );
      if (bare && (event.key === "Delete" || event.key === "Backspace")) {
        const next = unbind(keymap, action);
        onChange(next);
        stopCapture(`${bindingOf(action, next)}.`);
        return;
      }

      const chord = chordOf(native);
      // A modifier alone: wait for the key it modifies
      if (!chord) return;
      const refusal = refusalOf(chord);
      if (refusal) {
        onStatus(refusalMessage(refusal, text(chord), chord));
        return;
      }
      if (keymap[action] === chord) {
        stopCapture(`${bindingOf(action, keymap)}, unchanged.`);
        return;
      }

      setCapturing(null);
      const holder = conflictOf(keymap, action, chord);
      if (holder) setConflict({ action, chord, holder });
      else assign(action, chord);
    };

  const resolveConflict = (resolution: Resolution | null) => {
    if (!conflict) return;
    if (resolution) assign(conflict.action, conflict.chord, resolution);
    else onStatus(unchanged(conflict.action));
    setConflict(null);
  };

  const renderBinding = (action: ActionId) => {
    const chord = keymap[action];
    const isCapturing = capturing === action;
    const { control, direction } = parseAction(action);
    const onClick = (event: MouseEvent) => {
      if (!isCapturing) startCapture(action);
      // A second click cancels; a keyboard "click" (detail 0) is a key the
      // capture already handled
      else if (event.detail > 0) stopCapture(unchanged(action));
    };
    return (
      <button
        aria-describedby={noteId?.(action)}
        aria-label={`${describe(action)}: ${
          isCapturing ? "press a key" : chord ? text(chord) : "no shortcut"
        }`}
        className={`shortcut-key${isCapturing ? " shortcut-key--capturing" : ""}`}
        data-testid={`shortcut-${direction}-${control}`}
        onBlur={isCapturing ? () => stopCapture(unchanged(action)) : undefined}
        onClick={onClick}
        onKeyDown={isCapturing ? onCaptureKeyDown(action) : undefined}
        type="button"
      >
        {isCapturing ? (
          "Press a key"
        ) : chord ? (
          <KeyChord chord={chord} />
        ) : (
          <span aria-hidden="true" className="shortcut-key__none">
            —
          </span>
        )}
      </button>
    );
  };

  const renderRow = (control: ControlId, name: string) => (
    <tr key={control}>
      <th className="shortcuts-table__name" scope="row">
        <span className="shortcuts-table__label">
          <img
            alt=""
            className="shortcuts-table__icon"
            src={getAssetPath(iconOf(control))}
          />
          {name}
        </span>
      </th>
      {DIRECTIONS.map((direction) => (
        <td className="shortcuts-table__key" key={direction}>
          {renderBinding(`${direction}:${control}`)}
          {rowExtra?.(`${direction}:${control}`)}
        </td>
      ))}
    </tr>
  );

  const header = (first: string) => (
    <thead>
      <tr>
        <th scope="col">{first}</th>
        <th scope="col">Forward</th>
        <th scope="col">Back</th>
      </tr>
    </thead>
  );

  const conflictPrevious = conflict ? keymap[conflict.action] : undefined;

  return (
    <>
      <h3 className="shortcuts__heading" id={itemsHeading}>
        Items
      </h3>
      <table aria-labelledby={itemsHeading} className="shortcuts-table">
        {header("Item")}
        <tbody>
          {ITEM_CONTROLS.map((control) =>
            renderRow(control, controlName(control)),
          )}
        </tbody>
      </table>

      <h3 className="shortcuts__heading" id={dungeonsHeading}>
        Dungeons
      </h3>
      {keyCellsHint && <p className="shortcuts__hint">{keyCellsHint}</p>}
      <table aria-labelledby={dungeonsHeading} className="shortcuts-table">
        {header("Control")}
        {KEY_DUNGEONS.map((dungeon, index) => (
          <tbody key={dungeon}>
            <tr>
              <th
                className="shortcuts-table__group"
                colSpan={3}
                scope="rowgroup"
              >
                {dungeonName(index)}
              </th>
            </tr>
            {dungeonControls(index).map((control) =>
              renderRow(control, controlName(control)),
            )}
          </tbody>
        ))}
      </table>

      <Modal
        footer={
          <>
            <button
              className="modal-btn modal-btn--ghost"
              data-autofocus
              data-testid="shortcut-conflict-cancel"
              onClick={() => resolveConflict(null)}
              type="button"
            >
              Cancel
            </button>
            <button
              className={`modal-btn ${conflictPrevious ? "modal-btn--ghost" : "modal-btn--primary"}`}
              data-testid="shortcut-conflict-replace"
              onClick={() => resolveConflict("replace")}
              type="button"
            >
              Replace
            </button>
            {conflictPrevious && (
              <button
                className="modal-btn modal-btn--primary"
                data-testid="shortcut-conflict-swap"
                onClick={() => resolveConflict("swap")}
                type="button"
              >
                Swap
              </button>
            )}
          </>
        }
        isOpen={conflict !== null}
        onClose={() => resolveConflict(null)}
        title={conflict ? `${text(conflict.chord)} is already in use` : ""}
      >
        {conflict && (
          <p className="modal__message">
            {text(conflict.chord)} steps {describe(conflict.holder)}.{" "}
            {conflictPrevious
              ? `Swap moves it to ${text(conflictPrevious)}; Replace leaves it without a shortcut.`
              : "Replace leaves it without a shortcut."}
          </p>
        )}
      </Modal>
    </>
  );
};
