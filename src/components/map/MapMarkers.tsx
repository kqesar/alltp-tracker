import type { CSSProperties } from "react";
import { BOSS_STATES } from "@/constants";
import {
  type Availability,
  buildDungeonCaption,
  type ChestItem,
  type DungeonItem,
} from "@/data/logic";
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
  const opened = useGameStore((state) => state.chestsOpened[index]);
  const toggleChest = useGameStore((state) => state.toggleChest);
  const setCaption = useGameStore((state) => state.setCaption);

  const state: MarkerState = opened
    ? "opened"
    : chest.isAvailable(items, medallions);

  return (
    <button
      aria-label={`${captionToText(chest.name)}: ${STATE_LABELS[state]}`}
      aria-pressed={opened}
      className={`mapspan chest state-glyph ${state}`}
      data-testid={`chest-marker-${index}`}
      onBlur={() => setCaption("")}
      onClick={() => toggleChest(index)}
      onFocus={() => setCaption(chest.name)}
      onMouseEnter={() => setCaption(chest.name)}
      onMouseLeave={() => setCaption("")}
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
  const setCaption = useGameStore((state) => state.setCaption);

  const beaten = (items[`boss${index}`] as number) === BOSS_STATES.BEATEN;
  const bossState: MarkerState = beaten
    ? "opened"
    : dungeon.isBeatable(items, medallions, keysanity);
  const remaining = items[`chest${index}`] as number;
  const chestState: MarkerState =
    remaining === 0 ? "opened" : dungeon.canGetChest(items, medallions);

  const caption = buildDungeonCaption(dungeon, index, medallions);
  const chests = remaining === 1 ? "1 chest left" : `${remaining} chests left`;
  const show = () => setCaption(caption);
  const hide = () => setCaption("");

  return (
    <>
      <div
        aria-hidden="true"
        className={`mapspan dungeon state-glyph ${chestState}`}
        data-testid={`dungeon-marker-${index}`}
        onMouseEnter={show}
        onMouseLeave={hide}
        style={markerStyle(dungeon.x, dungeon.y, "poi.png")}
      />
      <button
        aria-label={`${captionToText(caption)}: boss ${STATE_LABELS[bossState]}, ${chests} (${STATE_LABELS[chestState]})`}
        aria-pressed={beaten}
        className={`mapspan boss state-glyph ${bossState}`}
        data-testid={`boss-marker-${index}`}
        onBlur={hide}
        onClick={() => handleItemClick(`boss${index}`)}
        onFocus={show}
        onMouseEnter={show}
        onMouseLeave={hide}
        style={markerStyle(dungeon.x, dungeon.y, dungeon.image)}
        type="button"
      />
    </>
  );
};
