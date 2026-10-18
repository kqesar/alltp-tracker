import { LEGACY_DUNGEONS } from "@alltp/pack-alttpr";
import {
  ChestCounter,
  MedallionPicker,
  RewardPicker,
} from "@/components/tracker/overlays/BossOverlays";
import { BOSS_STATES } from "@/constants";
import { itemLabels } from "@/data/items";
import { useControlShortcuts } from "@/hooks/useControlShortcuts";
import { useGridFocusable } from "@/hooks/useGridNavigation";
import { useStepHandlers } from "@/hooks/useStepHandlers";
import { useTooltip } from "@/hooks/useTooltip";
import { dungeonName } from "@/logic/settings";
import { useGameStore } from "@/stores/gameStore";
import { getItemBackground, isItemDimmed } from "@/utils";
import { mergeHandlers } from "@/utils/mergeHandlers";

type BossCellProps = {
  row: number;
  col: number;
  /** The cell's grid id, e.g. "boss3": the boss of key dungeon 3 */
  item: string;
};

/**
 * A dungeon's cell: the boss button (beaten or not) with, beside it in the
 * same cell, its medallion, chest-count and reward buttons. They are siblings
 * grouped under the dungeon's name, never buttons inside a button. Ganon's
 * Tower's cell (`boss12`) has its boss, Agahnim 2 (`agahnim2`, as on its map
 * marker), and its chests, and no reward: it gives none.
 */
export const BossCell = ({ row, col, item }: BossCellProps) => {
  const index = Number.parseInt(item.slice("boss".length), 10);
  const isTower = index >= LEGACY_DUNGEONS.length;
  const control = isTower ? "agahnim2" : item;
  const value = useGameStore((state) => state.items[control]);
  const handleItemClick = useGameStore((state) => state.handleItemClick);
  const beaten = value === (isTower ? 1 : BOSS_STATES.BEATEN);
  const handlers = mergeHandlers(
    useGridFocusable({ col, row, slot: 0 }),
    useStepHandlers(
      (direction) => handleItemClick(control, direction),
      useControlShortcuts(control).aria,
    ),
    // The boss cell shows what its dungeon needs, like its map marker
    useTooltip({ index, kind: "dungeon" }),
  );

  return (
    <fieldset
      aria-label={dungeonName(index)}
      className="grid-item-base boss-cell"
    >
      <button
        {...handlers}
        aria-label={`${itemLabels(control)}, ${beaten ? "defeated" : "not defeated"}. Click to change state.`}
        className={`griditem boss-cell__boss${isItemDimmed(control, value) ? " griditem--dimmed" : ""}`}
        data-testid={`item-${item}`}
        style={{ backgroundImage: getItemBackground(control, value) }}
        type="button"
      />
      <MedallionPicker col={col} index={index} row={row} />
      <ChestCounter col={col} index={index} row={row} />
      {!isTower && <RewardPicker col={col} index={index} row={row} />}
    </fieldset>
  );
};
