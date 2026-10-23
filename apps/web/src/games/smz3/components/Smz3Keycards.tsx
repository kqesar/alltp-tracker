import { KEYCARD_AREAS, KEYCARD_LEVELS, keycardId } from "@/games/smz3/data";
import { useSmz3Store } from "@/games/smz3/store";
import {
  GridFocusProvider,
  useGridFocusable,
  useGridNavigation,
} from "@/hooks/useGridNavigation";

/** A keycard, a toggle: a tick once found. */
const Keycard = ({
  col,
  id,
  name,
  row,
}: {
  col: number;
  id: string;
  name: string;
  row: number;
}) => {
  const held = useSmz3Store((state) => (state.items[id] ?? 0) > 0);
  const step = useSmz3Store((state) => state.step);
  const focusable = useGridFocusable({ col, row, slot: 0 });
  return (
    <button
      {...focusable}
      aria-label={name}
      aria-pressed={held}
      className="smz3-keycard"
      data-testid={`smz3-item-${id}`}
      onClick={() => step(id, held ? -1 : 1)}
      type="button"
    >
      <span aria-hidden="true">{held ? "✓" : ""}</span>
    </button>
  );
};

/**
 * Super Metroid's keycards under keysanity: an area a row, a level a column,
 * as the game's pause screen lists them. One Tab stop, the arrow keys moving
 * inside it, as in the item grid.
 */
export const Smz3Keycards = () => {
  const { containerRef, focus } = useGridNavigation();
  return (
    <section
      aria-labelledby="smz3-keycards-heading"
      className="board-panel smz3-tokens"
      data-testid="smz3-keycards"
      ref={containerRef}
    >
      <h2 className="board-panel__heading" id="smz3-keycards-heading">
        Keycards
      </h2>
      <GridFocusProvider value={focus}>
        <table className="smz3-keycards">
          <thead>
            <tr>
              <td />
              {KEYCARD_LEVELS.map((level) => (
                <th key={level.id} scope="col">
                  {level.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {KEYCARD_AREAS.map((area, row) => (
              <tr key={area.id}>
                <th scope="row">{area.name}</th>
                {KEYCARD_LEVELS.map((level, col) => (
                  <td key={level.id}>
                    {area.levels.includes(level.id) && (
                      <Keycard
                        col={col}
                        id={keycardId(area.id, level.id)}
                        name={`${area.name} ${level.name} keycard`}
                        row={row}
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </GridFocusProvider>
    </section>
  );
};
