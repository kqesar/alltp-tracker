import { BOSS_STATES } from "@/constants";
import {
  buildDungeonCaption,
  type ChestItem,
  type DungeonItem,
} from "@/data/logic";
import { useGameStore } from "@/stores/gameStore";
import { getAssetPath, transformMapCoordinates } from "@/utils";

type MarkerProps = {
  /** Extra classes identifying the marker kind, e.g. "chest map-chest" */
  variant: string;
  /** Availability class: available / possible / unavailable / opened */
  state: string;
  /** Asset filename drawn as the marker icon */
  asset: string;
  x: string;
  y: string;
  /** Caption shown while the pointer rests on the marker */
  caption: string;
  /** Test hook, e.g. "chest-marker-3" */
  testId: string;
  onClick?: () => void;
};

/**
 * Shared presentation for every marker pinned on the map: position, icon and
 * the hover caption. Only the availability rules differ between kinds.
 */
const Marker = ({
  variant,
  state,
  asset,
  x,
  y,
  caption,
  testId,
  onClick,
}: MarkerProps) => {
  const { mapLayout, setCaption } = useGameStore();
  const position = transformMapCoordinates(x, y, mapLayout);

  return (
    <div
      className={`mapspan ${variant} map-element-base ${state}`}
      data-testid={testId}
      onClick={onClick}
      onMouseOut={() => setCaption("")}
      onMouseOver={() => setCaption(caption)}
      style={{
        backgroundImage: `url(${getAssetPath(asset)})`,
        left: position.x,
        top: position.y,
      }}
    />
  );
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
  const { items, medallions, toggleChest } = useGameStore();

  return (
    <Marker
      asset="poi.png"
      caption={chest.name}
      onClick={() => toggleChest(index)}
      state={chest.isOpened ? "opened" : chest.isAvailable(items, medallions)}
      testId={`chest-marker-${index}`}
      variant="chest map-chest"
      x={chest.x}
      y={chest.y}
    />
  );
};

/**
 * A dungeon boss. Clicking it marks the boss beaten.
 * @param dungeon - The dungeon data
 * @param index - The dungeon index
 */
export const DungeonBoss = ({
  dungeon,
  index,
}: {
  dungeon: DungeonItem;
  index: number;
}) => {
  const { items, medallions, settings, toggleDungeonBoss } = useGameStore();

  const beaten =
    (items[`boss${index}`] as number) === BOSS_STATES.BEATEN ||
    dungeon.isBeaten;

  return (
    <Marker
      asset={dungeon.image}
      caption={buildDungeonCaption(dungeon, index, medallions)}
      onClick={() => toggleDungeonBoss(index)}
      state={
        beaten
          ? "opened"
          : dungeon.isBeatable(items, medallions, settings.keysanity)
      }
      testId={`boss-marker-${index}`}
      variant="boss"
      x={dungeon.x}
      y={dungeon.y}
    />
  );
};

/**
 * The remaining-chests indicator for a dungeon. Display only: the count is
 * changed from the tracker grid, not from the map.
 * @param dungeon - The dungeon data
 * @param index - The dungeon index
 */
export const DungeonChest = ({
  dungeon,
  index,
}: {
  dungeon: DungeonItem;
  index: number;
}) => {
  const { items, medallions } = useGameStore();
  const remaining = items[`chest${index}`] as number;

  return (
    <Marker
      asset="poi.png"
      caption={buildDungeonCaption(dungeon, index, medallions)}
      state={
        remaining === 0 ? "opened" : dungeon.canGetChest(items, medallions)
      }
      testId={`dungeon-marker-${index}`}
      variant="dungeon"
      x={dungeon.x}
      y={dungeon.y}
    />
  );
};
