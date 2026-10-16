import { LEGACY_CHESTS } from "@alltp/pack-alttpr";
import type { CSSProperties } from "react";
import { BOSS_STATES } from "@/constants";
import {
  type Availability,
  buildDungeonCaption,
  type ChestItem,
  type DungeonItem,
} from "@/data/logic";
import { useTooltip } from "@/hooks/useTooltip";
import { useGameStore } from "@/stores/gameStore";
import { getAssetPath, toWorldPosition } from "@/utils";
import { captionToText } from "@/utils/caption";

/** What a marker shows: an availability, or done. */
type MarkerState = Availability | "opened";

/** The words a screen reader hears for each state; the glyph says it on screen. */
const STATE_LABELS: Record<MarkerState, string> = {
  available: "available",
  opened: "done",
  possible: "maybe available",
  unavailable: "out of logic",
};

/** Position, icon and sizing variables shared by every marker. */
const markerStyle = (
  x: string,
  y: string,
  asset: string,
): CSSProperties & Record<"--x" | "--y", string> => {
  const position = toWorldPosition(x, y);
  return {
    "--x": `${position.x}%`,
    "--y": `${position.y}%`,
    backgroundImage: `url(${getAssetPath(asset)})`,
  };
};

/**
 * An overworld chest. Clicking it marks the chest opened.
 * @param chest - The chest data
 * @param index - Its index in the chest list
 */
export const MapChest = ({
  chest,
  index,
}: {
  chest: ChestItem;
  index: number;
}) => {
  const items = useGameStore((state) => state.items);
  const medallions = useGameStore((state) => state.medallions);
  const locations = LEGACY_CHESTS[index]?.locations ?? [];
  const opened = useGameStore(
    (state) =>
      locations.length > 0 && locations.every((id) => state.checked[id]),
  );
  const toggleChecks = useGameStore((state) => state.toggleChecks);
  const tooltip = useTooltip({ index, kind: "chest" });

  const state: MarkerState = opened
    ? "opened"
    : chest.isAvailable(items, medallions);

  return (
    <button
      {...tooltip}
      aria-label={`${captionToText(chest.name)}: ${STATE_LABELS[state]}`}
      aria-pressed={opened}
      className={`mapspan chest state-glyph ${state}`}
      data-testid={`chest-marker-${index}`}
      onClick={() => toggleChecks(locations)}
      style={markerStyle(chest.x, chest.y, "poi.png")}
      type="button"
    />
  );
};

/**
 * A dungeon: a square showing whether its chests can be reached, under the
 * boss icon, the button, which shows whether the boss can be beaten.
 * Clicking it marks the boss beaten, the same flag as the grid's boss cell.
 * @param dungeon - The dungeon data
 * @param index - The dungeon index
 */
export const MapDungeon = ({
  dungeon,
  index,
}: {
  dungeon: DungeonItem;
  index: number;
}) => {
  const items = useGameStore((state) => state.items);
  const medallions = useGameStore((state) => state.medallions);
  const keysanity = useGameStore((state) => state.settings.keysanity);
  const handleItemClick = useGameStore((state) => state.handleItemClick);
  const tooltip = useTooltip({ index, kind: "dungeon" });

  const beaten = (items[`boss${index}`] as number) === BOSS_STATES.BEATEN;
  const bossState: MarkerState = beaten
    ? "opened"
    : dungeon.isBeatable(items, medallions, keysanity);
  const remaining = items[`chest${index}`] as number;
  const chestState: MarkerState =
    remaining === 0 ? "opened" : dungeon.canGetChest(items, medallions);

  const caption = buildDungeonCaption(dungeon, index, medallions);
  const chests = remaining === 1 ? "1 chest left" : `${remaining} chests left`;

  return (
    <>
      <div
        aria-hidden="true"
        className={`mapspan dungeon state-glyph ${chestState}`}
        data-testid={`dungeon-marker-${index}`}
        onPointerEnter={tooltip.onPointerEnter}
        onPointerLeave={tooltip.onPointerLeave}
        style={markerStyle(dungeon.x, dungeon.y, "poi.png")}
      />
      <button
        {...tooltip}
        aria-label={`${captionToText(caption)}: boss ${STATE_LABELS[bossState]}, ${chests} (${STATE_LABELS[chestState]})`}
        aria-pressed={beaten}
        className={`mapspan boss state-glyph ${bossState}`}
        data-testid={`boss-marker-${index}`}
        onClick={() => handleItemClick(`boss${index}`)}
        style={markerStyle(dungeon.x, dungeon.y, dungeon.image)}
        type="button"
      />
    </>
  );
};
