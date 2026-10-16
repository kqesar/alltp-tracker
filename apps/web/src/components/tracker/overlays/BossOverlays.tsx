import { DUNGEON_INDICES } from "@/constants";
import { dungeons } from "@/data/dungeons";
import { type GridPosition, useGridFocusable } from "@/hooks/useGridNavigation";
import { useStepHandlers } from "@/hooks/useStepHandlers";
import { type Direction, useGameStore } from "@/stores/gameStore";
import { getAssetPath } from "@/utils";
import { placeName } from "@/utils/caption";

/** Corner of the boss cell an overlay occupies. */
type Corner = "top-right" | "bottom-left" | "bottom-right";

type OverlayProps = {
  corner: Corner;
  /** Asset filename, without the assets/ prefix */
  asset: string;
  /** What a screen reader hears: the dungeon, the counter and its value */
  label: string;
  position: GridPosition;
  step: (direction: Direction) => void;
  testId: string;
};

/**
 * A small button layered onto a corner of a boss cell, beside the boss button
 * rather than inside it. Click steps it forward, right-click back.
 */
const Overlay = ({
  corner,
  asset,
  label,
  position,
  step,
  testId,
}: OverlayProps) => (
  <button
    {...useGridFocusable(position)}
    {...useStepHandlers(step)}
    aria-label={label}
    className={`overlay-base overlay--${corner}`}
    data-testid={testId}
    style={{ backgroundImage: `url(${getAssetPath(asset)})` }}
    type="button"
  />
);

/** The prize a dungeon's boss drops, by the value of `rewardN`. */
const REWARD_LABELS = [
  "unknown",
  "the Pendant of Courage",
  "a pendant",
  "a crystal",
  "crystal 5 or 6",
];

/** The medallion a dungeon's entrance asks for, by the value of `medallions[n]`. */
const MEDALLION_LABELS = ["unknown", "Bombos", "Ether", "Quake"];

type CornerProps = {
  /** The dungeon index (0-9) */
  index: number;
  row: number;
  col: number;
};

/**
 * Chests left in the dungeon (bottom left). Clicking counts one down.
 * @param index - The dungeon index (0-9)
 */
export const ChestCounter = ({ index, row, col }: CornerProps) => {
  const remaining = useGameStore((state) => state.items[`chest${index}`]);
  const handleItemClick = useGameStore((state) => state.handleItemClick);

  return (
    <Overlay
      asset={`chest${remaining}.png`}
      corner="bottom-left"
      label={`${placeName(dungeons[index].name)} chests: ${remaining} left`}
      position={{ col, row, slot: 2 }}
      step={(direction) => handleItemClick(`chest${index}`, direction)}
      testId={`chest-overlay-${index}`}
    />
  );
};

/**
 * The boss's prize (bottom right): unknown, a pendant, or a crystal.
 * @param index - The dungeon index (0-9)
 */
export const RewardPicker = ({ index, row, col }: CornerProps) => {
  const reward = useGameStore(
    (state) => state.items[`reward${index}`] as number,
  );
  const handleItemClick = useGameStore((state) => state.handleItemClick);

  return (
    <Overlay
      asset={`dungeon${reward}.png`}
      corner="bottom-right"
      label={`${placeName(dungeons[index].name)} reward: ${REWARD_LABELS[reward]}`}
      position={{ col, row, slot: 3 }}
      step={(direction) => handleItemClick(`reward${index}`, direction)}
      testId={`reward-overlay-${index}`}
    />
  );
};

/** Number of medallion states: unknown, Bombos, Ether, Quake. */
const MEDALLION_STATES = MEDALLION_LABELS.length;

/**
 * The medallion that opens Misery Mire or Turtle Rock (top right). Nothing is
 * drawn for the other dungeons.
 * @param index - The dungeon index (0-9)
 */
export const MedallionPicker = ({ index, row, col }: CornerProps) => {
  const stored = useGameStore((state) => state.medallions[index]);
  const handleMedallionChange = useGameStore(
    (state) => state.handleMedallionChange,
  );

  if (
    index !== DUNGEON_INDICES.MISERY_MIRE &&
    index !== DUNGEON_INDICES.TURTLE_ROCK
  ) {
    return null;
  }

  // Modulo keeps a malformed stored value pointing at a real asset.
  const medallion = stored % MEDALLION_STATES;

  return (
    <Overlay
      asset={`medallion${medallion}.png`}
      corner="top-right"
      label={`${placeName(dungeons[index].name)} medallion: ${MEDALLION_LABELS[medallion]}`}
      position={{ col, row, slot: 1 }}
      step={(direction) =>
        handleMedallionChange(
          index,
          (medallion + direction + MEDALLION_STATES) % MEDALLION_STATES,
        )
      }
      testId={`medallion-overlay-${index}`}
    />
  );
};
