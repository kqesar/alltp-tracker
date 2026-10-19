import { ITEMS } from "@alltp/pack-smz3";
import type { CSSProperties, KeyboardEvent, MouseEvent } from "react";
import { type Cell, gridOf, type KeyCell } from "@/games/smz3/data";
import { useSmz3Store } from "@/games/smz3/store";
import {
  GridFocusProvider,
  type GridPosition,
  useGridFocusable,
  useGridNavigation,
} from "@/hooks/useGridNavigation";

const MAX = new Map(ITEMS.map((item) => [item.id, item.max]));

/** An ALttPR asset's address. */
const asset = (file: string) => `${import.meta.env.BASE_URL}assets/${file}`;

/** A cell's state in words: held or not, its level, or how many of how many. */
const describe = (id: string, value: number) => {
  const max = MAX.get(id) ?? 1;
  if (max === 1) return value > 0 ? "obtained" : "not obtained";
  return `${value} of ${max}`;
};

/**
 * What a control of the grid spreads to step its item: a click adds one, a
 * right-click or "-" takes one away, wrapping within its pool, as the other
 * boards' cells step. Its value, and its name with that state in words.
 */
const useStepControl = (id: string, name: string, position: GridPosition) => {
  const value = useSmz3Store((state) => state.items[id] ?? 0);
  const step = useSmz3Store((state) => state.step);
  const focusable = useGridFocusable(position);
  return {
    props: {
      ...focusable,
      "aria-label": `${name}, ${describe(id, value)}. Click to change state.`,
      "data-testid": `smz3-item-${id}`,
      onClick: () => step(id, 1),
      onContextMenu: (event: MouseEvent) => {
        event.preventDefault();
        step(id, -1);
      },
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key === "-") {
          event.preventDefault();
          step(id, -1);
        }
      },
      type: "button" as const,
    },
    value,
  };
};

/** One item of the grid, greyed while not held, with how many for a counted item. */
const Smz3Cell = ({
  cell,
  col,
  row,
}: {
  cell: Cell;
  col: number;
  row: number;
}) => {
  const { props, value } = useStepControl(cell.id, cell.name, {
    col,
    row,
    slot: 0,
  });
  const max = MAX.get(cell.id) ?? 1;
  const { sprite } = cell;
  const style =
    "frame" in sprite
      ? ({ "--frame": sprite.frame } as CSSProperties)
      : ({
          "--sprite": `url(${asset(sprite.asset(value))})`,
        } as CSSProperties);
  return (
    <button
      {...props}
      className={`griditem grid-item-base ${"frame" in sprite ? "smz3-cell--sm" : "smz3-cell--zelda"}${value === 0 ? " griditem--dimmed" : ""}`}
      style={style}
    >
      {max > 1 && !cell.leveled && value > 0 && (
        <span aria-hidden="true" className="smz3-cell__count">
          {value}
        </span>
      )}
    </button>
  );
};

/** A dungeon's big key or small keys: ALttPR's key art, greyed while none is found. */
const KeyButton = ({
  file,
  id,
  name,
  position,
}: {
  file: string;
  id: string;
  name: string;
  position: GridPosition;
}) => {
  const { props, value } = useStepControl(id, name, position);
  return (
    <button
      {...props}
      className={`overlay-base key-toggle${value === 0 ? " griditem--dimmed" : ""}`}
      style={{ backgroundImage: `url(${asset(file)})` }}
    />
  );
};

/**
 * A dungeon's keys under keysanity, laid as ALttPR's key cell: its short name
 * top left (decorative, each button naming its dungeon), the big key top
 * right, the small keys bottom left with their count beside them. The two
 * buttons sit diagonally, so they keep the 24 px target spacing on a phone.
 */
const Smz3KeyCell = ({
  col,
  keys,
  row,
}: {
  col: number;
  keys: KeyCell;
  row: number;
}) => {
  const small = useSmz3Store((state) =>
    keys.smallKey ? (state.items[keys.smallKey] ?? 0) : 0,
  );
  const smallMax = keys.smallKey ? (MAX.get(keys.smallKey) ?? 1) : 0;
  return (
    <div
      className="griditem grid-item-base bigkey-container"
      data-testid={`smz3-keys-${keys.short}`}
    >
      <div className="bigkey-grid">
        <div aria-hidden="true" className="bigkey-quadrant key-label">
          {keys.short}
        </div>
        <div className="bigkey-quadrant">
          {keys.bigKey && (
            <KeyButton
              file="bigkey.png"
              id={keys.bigKey}
              name={`${keys.dungeon} big key`}
              position={{ col, row, slot: 0 }}
            />
          )}
        </div>
        <div className="bigkey-quadrant">
          {keys.smallKey && (
            <KeyButton
              file="smallkey.png"
              id={keys.smallKey}
              name={`${keys.dungeon} ${smallMax > 1 ? "small keys" : "small key"}`}
              position={{ col, row, slot: 1 }}
            />
          )}
        </div>
        <div
          aria-hidden="true"
          className={`bigkey-quadrant bigkey-count${small === smallMax ? " bigkey-count--maxed" : ""}`}
        >
          {keys.smallKey && small}
        </div>
      </div>
    </div>
  );
};

/**
 * The SMZ3 grid: A Link to the Past's items (its dungeons' keys under
 * keysanity), then Super Metroid's, then the rewards found, a single Tab stop
 * with the arrow keys moving inside it (useGridNavigation).
 */
export const Smz3Grid = () => {
  const { containerRef, focus } = useGridNavigation();
  const keysanity = useSmz3Store((state) => state.settings.keysanity);
  return (
    <section
      aria-label="Item tracker grid"
      className="smz3-grid"
      data-testid="item-grid"
      ref={containerRef}
    >
      <h2 className="sr-only">Items</h2>
      <GridFocusProvider value={focus}>
        <div className="smz3-grid__cells">
          {gridOf(keysanity).map((row, rowIndex) =>
            row.map((slot, colIndex) =>
              slot === null ? (
                <div
                  aria-hidden="true"
                  className="grid-item-base"
                  // biome-ignore lint/suspicious/noArrayIndexKey: a fixed place in the grid
                  key={`${rowIndex}-${colIndex}`}
                />
              ) : "short" in slot ? (
                <Smz3KeyCell
                  col={colIndex}
                  key={slot.short}
                  keys={slot}
                  row={rowIndex}
                />
              ) : (
                <Smz3Cell
                  cell={slot}
                  col={colIndex}
                  key={slot.id}
                  row={rowIndex}
                />
              ),
            ),
          )}
        </div>
      </GridFocusProvider>
    </section>
  );
};
