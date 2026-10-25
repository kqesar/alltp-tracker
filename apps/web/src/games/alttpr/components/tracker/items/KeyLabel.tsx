import type { DungeonId } from "@alltp/pack-alttpr";
import { dungeonAt } from "@/games/alttpr/logic/settings";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

/**
 * The short names of the castle dungeons, as keysanity trackers label their
 * key rows (CodeTracker's hc_label, at_label, gt_label). Castle Tower has
 * none: Agahnim's cell stands there, as the head of its keys. Ganon's Tower's
 * also marks its boss cell, whose Agahnim 2 would pass for Castle Tower's.
 */
export const SHORT_NAMES: Partial<Record<DungeonId, string>> = {
  "ganons-tower": "GT",
  "hyrule-castle": "HC",
};

type KeyLabelProps = {
  row: number;
  col: number;
  /** The label's grid id, e.g. "keylabel10": key dungeon 10 */
  item: string;
};

/**
 * The short name of a castle dungeon, beside its key cell: it has no boss
 * cell above to tell it. Decorative: each of the cell's buttons names its
 * dungeon. A placeholder while the key cells are hidden.
 */
export const KeyLabel = ({ row, col, item }: KeyLabelProps) => {
  const bigKeysVisible = useGameStore((state) => state.bigKeysVisible);
  const id = dungeonAt(parseInt(item.replace("keylabel", ""), 10));

  return (
    <div
      aria-hidden="true"
      className={bigKeysVisible ? "key-label" : "grid-spacer"}
      data-grid-col={col}
      data-grid-row={row}
      data-testid={`key-label-${id}`}
    >
      {bigKeysVisible && SHORT_NAMES[id]}
    </div>
  );
};
