import type { DungeonId } from "@alltp/pack-alttpr";
import { dungeonAt } from "@/games/alttpr/logic/settings";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

/**
 * The dungeons' short names, as racers write them and other trackers label
 * them (CodeTracker's hc_label, at_label, gt_label): each boss cell's top
 * left corner, Agahnim's for Castle Tower, and Hyrule Castle's key cell,
 * which has no boss cell above it. With shuffled bosses a boss's sprite no
 * longer tells its dungeon; the name does.
 */
export const SHORT_NAMES: Readonly<Record<DungeonId, string>> = {
  "castle-tower": "CT",
  "desert-palace": "DP",
  "eastern-palace": "EP",
  "ganons-tower": "GT",
  "hyrule-castle": "HC",
  "ice-palace": "IP",
  "misery-mire": "MM",
  "palace-of-darkness": "PoD",
  "skull-woods": "SW",
  "swamp-palace": "SP",
  "thieves-town": "TT",
  "tower-of-hera": "ToH",
  "turtle-rock": "TR",
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
