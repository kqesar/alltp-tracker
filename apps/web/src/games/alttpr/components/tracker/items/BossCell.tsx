import { LEGACY_DUNGEONS } from "@alltp/pack-alttpr";
import { SHORT_NAMES } from "@/games/alttpr/components/tracker/items/KeyLabel";
import {
  ChestCounter,
  KnownBossPicker,
  MedallionPicker,
  RewardPicker,
} from "@/games/alttpr/components/tracker/overlays/BossOverlays";
import { BOSS_STATES } from "@/games/alttpr/constants";
import { itemLabels } from "@/games/alttpr/data/items";
import { useControlShortcuts } from "@/games/alttpr/hooks/useControlShortcuts";
import { useStepHandlers } from "@/games/alttpr/hooks/useStepHandlers";
import { bossName, knownBossShown } from "@/games/alttpr/logic/knownBosses";
import { dungeonAt, dungeonName } from "@/games/alttpr/logic/settings";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { getItemBackground, isItemDimmed } from "@/games/alttpr/utils";
import { useGridFocusable } from "@/hooks/useGridNavigation";
import { useTooltip } from "@/hooks/useTooltip";
import { mergeHandlers } from "@/utils/mergeHandlers";

type BossCellProps = {
  row: number;
  col: number;
  /** The cell's grid id, e.g. "boss3": the boss of key dungeon 3 */
  item: string;
};

/**
 * A dungeon's cell: the boss button (beaten or not) with, beside it in the
 * same cell, its known boss (under boss shuffle), medallion, chest-count and
 * reward buttons. They are siblings
 * grouped under the dungeon's name, never buttons inside a button. Ganon's
 * Tower's cell (`boss12`) has its boss, Agahnim 2 (`agahnim2`, as on its map
 * marker), and its chests, and no reward: it gives none. The dungeon's short
 * name (SHORT_NAMES: EP, PoD, GT…) sits in the top left corner, decorative
 * (the fieldset names the dungeon), so the board reads at a glance and
 * Ganon's Tower's Agahnim is not taken for Castle Tower's. Under boss
 * shuffle that corner is the boss's marker (KnownBossPicker), and the
 * portrait, the dungeon's own boss, still tells the dungeon.
 */
export const BossCell = ({ row, col, item }: BossCellProps) => {
  const index = Number.parseInt(item.slice("boss".length), 10);
  const isTower = index >= LEGACY_DUNGEONS.length;
  const control = isTower ? "agahnim2" : item;
  const value = useGameStore((state) => state.items[control]);
  const handleItemClick = useGameStore((state) => state.handleItemClick);
  const beaten = value === (isTower ? 1 : BOSS_STATES.BEATEN);
  // Under boss shuffle the boss's marker holds the top left corner
  const marked = useGameStore(
    (state) => !isTower && knownBossShown(index, state.settings),
  );
  // The boss the run knows there, else the dungeon's: bosses may be shuffled
  const name = useGameStore((state) =>
    isTower ? itemLabels(control) : bossName(index, state),
  );
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
        aria-label={`${name}, ${beaten ? "defeated" : "not defeated"}. Click to change state.`}
        className={`griditem boss-cell__boss${isItemDimmed(control, value) ? " griditem--dimmed" : ""}`}
        data-testid={`item-${item}`}
        style={{ backgroundImage: getItemBackground(control, value) }}
        type="button"
      />
      {!marked && (
        <span
          aria-hidden="true"
          className="boss-cell__name"
          data-testid={`boss-name-${index}`}
        >
          {SHORT_NAMES[dungeonAt(index)]}
        </span>
      )}
      {!isTower && <KnownBossPicker col={col} index={index} row={row} />}
      <MedallionPicker col={col} index={index} row={row} />
      <ChestCounter col={col} index={index} row={row} />
      {!isTower && <RewardPicker col={col} index={index} row={row} />}
    </fieldset>
  );
};
