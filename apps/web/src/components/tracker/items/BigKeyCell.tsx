import { KeyToggle } from "@/components/tracker/items/KeyToggle";
import { wildItems } from "@/data/presets";
import { ownItems, smallKeysMax } from "@/logic/settings";
import { useGameStore } from "@/stores/gameStore";

type BigKeyCellProps = {
  row: number;
  col: number;
  /** The key cell's grid id, e.g. "keys3": key dungeon 3 */
  item: string;
};

/**
 * BigKeyCell renders a dungeon's key cell, 2x2. With the dungeon items in
 * their dungeon: the big key top right, the small key and its count below.
 * With maps and compasses outside (MC, MCS and Full Shuffle), where its boss
 * also wants them, the map and compass on top, the small key (its count as a
 * badge on it) and the big key below. It shows only what the dungeon's pool
 * holds (ownItems, smallKeysMax): Eastern Palace has no small key, Hyrule
 * Castle no big key or compass, Castle Tower small keys alone. A retro
 * run's small keys are generic, no dungeon's: no key cell shows them. When
 * the key
 * cells are hidden it renders an empty, non-interactive placeholder so the
 * grid layout stays stable.
 */
export const BigKeyCell = ({ row, col, item }: BigKeyCellProps) => {
  const dungeonIndex = parseInt(item.replace("keys", ""), 10);
  const bigKeysVisible = useGameStore((state) => state.bigKeysVisible);
  const withMaps = useGameStore(
    (state) => wildItems(state.settings).mapsAndCompasses,
  );
  const keyCount = useGameStore((state) => state.smallKeys[dungeonIndex] || 0);
  const genericKeys = useGameStore((state) => state.settings.mode === "retro");

  if (!bigKeysVisible) {
    return (
      <div
        aria-hidden="true"
        className="grid-spacer"
        data-grid-col={col}
        data-grid-row={row}
      />
    );
  }

  const maxKeys = genericKeys ? 0 : smallKeysMax(dungeonIndex);
  const own = ownItems(dungeonIndex);
  const toggle = (variant: "big-key" | "small-key" | "map" | "compass") => (
    <KeyToggle
      col={col}
      dungeonIndex={dungeonIndex}
      row={row}
      variant={variant}
    />
  );
  // The count, which the small key's own name also says
  const count = (
    <div
      aria-hidden="true"
      className={`bigkey-count${withMaps ? " bigkey-count--badge" : ""}${keyCount === maxKeys ? " bigkey-count--maxed" : ""}`}
    >
      {keyCount}
    </div>
  );

  return (
    <div
      className="griditem grid-item-base bigkey-container"
      data-grid-col={col}
      data-grid-row={row}
    >
      {withMaps ? (
        <div className="bigkey-grid">
          <div className="bigkey-quadrant">{own.map && toggle("map")}</div>
          <div className="bigkey-quadrant">
            {own.compass && toggle("compass")}
          </div>
          <div className="bigkey-quadrant">
            {maxKeys > 0 && (
              <>
                {toggle("small-key")}
                {count}
              </>
            )}
          </div>
          <div className="bigkey-quadrant">
            {own.bigKey && toggle("big-key")}
          </div>
        </div>
      ) : (
        <div className="bigkey-grid">
          <div className="bigkey-quadrant" />
          <div className="bigkey-quadrant">
            {own.bigKey && toggle("big-key")}
          </div>
          <div className="bigkey-quadrant">
            {maxKeys > 0 && toggle("small-key")}
          </div>
          <div className="bigkey-quadrant">{maxKeys > 0 && count}</div>
        </div>
      )}
    </div>
  );
};
