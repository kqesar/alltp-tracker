import { useControlShortcuts } from "@/hooks/useControlShortcuts";
import { useGridFocusable } from "@/hooks/useGridNavigation";
import { useStepHandlers } from "@/hooks/useStepHandlers";
import { dungeonName, smallKeysMax } from "@/logic/settings";
import { useGameStore } from "@/stores/gameStore";
import { getAssetPath } from "@/utils";

/** Which of a dungeon's own items a key cell button drives. */
export type KeyVariant = "big-key" | "small-key" | "map" | "compass";

/**
 * Each variant's item id prefix (the store's, `bigkey3`; the small keys are
 * counted apart, `smallkey3` being their shortcut control), its name, its
 * art and its slot in the cell: the big key is the cell's main control.
 */
const VARIANTS: Record<
  KeyVariant,
  { prefix: string; name: string; asset: string; slot: number }
> = {
  "big-key": {
    asset: "bigkey.png",
    name: "big key",
    prefix: "bigkey",
    slot: 0,
  },
  compass: {
    asset: "compass.png",
    name: "compass",
    prefix: "compass",
    slot: 2,
  },
  map: { asset: "dungeonmap.png", name: "map", prefix: "map", slot: 1 },
  "small-key": {
    asset: "smallkey.png",
    name: "small keys",
    prefix: "smallkey",
    slot: 3,
  },
};

type KeyToggleProps = {
  /** Key dungeon index (0-12, KEY_DUNGEONS) */
  dungeonIndex: number;
  /** Grid row index for positioning */
  row: number;
  /** Grid column index for positioning */
  col: number;
  /** Which of the dungeon's items this button drives */
  variant: KeyVariant;
};

/**
 * A button of a dungeon's key cell: its big key, its small keys, and its map
 * and compass while they leave their dungeons (MC Shuffle and up). The held-or-not items (big key, map,
 * compass) step their item in the store; the small keys step their count.
 * An item not held yet is greyed, as any missing item; the cell's count says
 * how many small keys are found.
 * @param dungeonIndex - The key dungeon index (0-12, KEY_DUNGEONS)
 * @param row - Grid row for positioning
 * @param col - Grid column for positioning
 * @param variant - The item the button drives
 */
export const KeyToggle = ({
  dungeonIndex,
  row,
  col,
  variant,
}: KeyToggleProps) => {
  const { asset, name, prefix, slot } = VARIANTS[variant];
  const isSmallKey = variant === "small-key";
  const control = `${prefix}${dungeonIndex}`;
  const held = useGameStore((state) =>
    isSmallKey
      ? state.smallKeys[dungeonIndex] || 0
      : state.items[control] === 1
        ? 1
        : 0,
  );
  const handleItemClick = useGameStore((state) => state.handleItemClick);
  const handleSmallKeyClick = useGameStore(
    (state) => state.handleSmallKeyClick,
  );

  const focusable = useGridFocusable({ col, row, slot });
  const shortcuts = useControlShortcuts(control);
  const steps = useStepHandlers((direction) => {
    if (isSmallKey) handleSmallKeyClick(dungeonIndex, direction);
    else handleItemClick(control, direction);
  }, shortcuts.aria);
  const dungeon = dungeonName(dungeonIndex);

  const label = isSmallKey
    ? `${dungeon} ${name}: ${held} of ${smallKeysMax(dungeonIndex)}`
    : `${dungeon} ${name}: ${held === 1 ? "obtained" : "not obtained"}`;

  return (
    <button
      aria-label={label}
      // Not held yet (no item, no small key found): greyed like any missing
      // item, by the one shared dimmed style
      className={`overlay-base key-toggle${held === 0 ? " griditem--dimmed" : ""}`}
      {...focusable}
      {...steps}
      data-dungeon={dungeonIndex}
      data-testid={`${variant}-${dungeonIndex}`}
      style={{ backgroundImage: `url(${getAssetPath(asset)})` }}
      title={label}
      type="button"
    />
  );
};
