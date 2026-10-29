import {
  BOTTLE_CONTENT_NAMES,
  BOTTLE_CONTENTS,
  BOTTLE_SLOTS,
  type BottleContents,
  itemLabels,
} from "@/games/alttpr/data/items";
import { useControlShortcuts } from "@/games/alttpr/hooks/useControlShortcuts";
import { useStepHandlers } from "@/games/alttpr/hooks/useStepHandlers";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { getAssetPath } from "@/games/alttpr/utils";
import { useGridFocusable } from "@/hooks/useGridNavigation";
import { mergeHandlers } from "@/utils/mergeHandlers";

type BottleCellProps = {
  row: number;
  col: number;
  /** The bottle, 1 to 4 */
  slot: number;
};

/**
 * The sprite of what a bottle holds: the game's empty bottle, or that
 * bottle filled (`apps/web/scripts/bottle-icons.mjs`).
 * @param contents - What the bottle holds
 */
export const bottleSprite = (contents: BottleContents): string =>
  contents === "empty" ? "bottle0.png" : `bottle-${contents}.png`;

/**
 * One of the four bottles: what it holds, greyed while the bottle is not
 * found. The game fills its bottles in order, so a bottle is there while
 * its slot is within the bottles' count (`bottle`). A click on a bottle not
 * there finds the bottles up to it; on one there, the next content, round
 * from the good bee to empty; a right-click or "-" the content before, and
 * from empty the bottle goes (`bottleAfter`). Autotracking reads both from
 * the game, in Race Mode too (v2.0's "bottle contents").
 */
export const BottleCell = ({ row, col, slot }: BottleCellProps) => {
  const id = BOTTLE_SLOTS[slot - 1] ?? "bottlecontents1";
  const held = useGameStore((state) => slot <= Number(state.items.bottle));
  const value = useGameStore((state) => Number(state.items[id] ?? 0));
  const handleItemClick = useGameStore((state) => state.handleItemClick);
  const contents = BOTTLE_CONTENTS[value] ?? "empty";
  const handlers = mergeHandlers(
    useGridFocusable({ col, row, slot: 0 }),
    useStepHandlers(
      (direction) => handleItemClick(id, direction),
      useControlShortcuts(id).aria,
    ),
  );
  const state = held ? BOTTLE_CONTENT_NAMES[contents] : "not found";

  return (
    <button
      {...handlers}
      aria-label={`${itemLabels(id)}, ${state}. Click to change.`}
      className={`griditem grid-item-base${held ? "" : " griditem--dimmed"}`}
      data-contents={held ? contents : undefined}
      data-testid={`item-${id}`}
      style={{
        backgroundImage: `url(${getAssetPath(bottleSprite(held ? contents : "empty"))})`,
      }}
      type="button"
    />
  );
};
