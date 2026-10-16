import {
  ChestCounter,
  MedallionPicker,
  RewardPicker,
} from "@/components/tracker/overlays/BossOverlays";
import { BOSS_STATES } from "@/constants";
import { dungeons } from "@/data/dungeons";
import { itemLabels } from "@/data/items";
import { useControlShortcuts } from "@/hooks/useControlShortcuts";
import { useGridFocusable } from "@/hooks/useGridNavigation";
import { useStepHandlers } from "@/hooks/useStepHandlers";
import { useTooltip } from "@/hooks/useTooltip";
import { useGameStore } from "@/stores/gameStore";
import { getItemBackground } from "@/utils";
import { placeName } from "@/utils/caption";
import { mergeHandlers } from "@/utils/mergeHandlers";

type BossCellProps = {
  row: number;
  col: number;
  /** The boss item identifier, e.g. "boss3" */
  item: string;
};

/**
 * A dungeon's cell: the boss button (beaten or not) with, beside it in the
 * same cell, its medallion, chest-count and reward buttons. They are siblings
 * grouped under the dungeon's name, never buttons inside a button.
 */
export const BossCell = ({ row, col, item }: BossCellProps) => {
  const index = Number.parseInt(item.slice("boss".length), 10);
  const value = useGameStore((state) => state.items[item]);
  const handleItemClick = useGameStore((state) => state.handleItemClick);
  const beaten = value === BOSS_STATES.BEATEN;
  const handlers = mergeHandlers(
    useGridFocusable({ col, row, slot: 0 }),
    useStepHandlers(
      (direction) => handleItemClick(item, direction),
      useControlShortcuts(item).aria,
    ),
    // The boss cell shows what its dungeon needs, like its map marker
    useTooltip({ index, kind: "dungeon" }),
  );

  return (
    <fieldset
      aria-label={placeName(dungeons[index].name)}
      className="grid-item-base boss-cell"
    >
      <button
        {...handlers}
        aria-label={`${itemLabels(item)}, ${beaten ? "defeated" : "not defeated"}. Click to change state.`}
        className="griditem boss-cell__boss"
        data-testid={`item-${item}`}
        style={{ backgroundImage: getItemBackground(item, value) }}
        type="button"
      />
      <MedallionPicker col={col} index={index} row={row} />
      <ChestCounter col={col} index={index} row={row} />
      <RewardPicker col={col} index={index} row={row} />
    </fieldset>
  );
};
