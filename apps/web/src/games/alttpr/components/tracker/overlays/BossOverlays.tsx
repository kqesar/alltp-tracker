import { DUNGEON_INDICES } from "@/games/alttpr/constants";
import type { ControlId } from "@/games/alttpr/data/keymap";
import { useControlShortcuts } from "@/games/alttpr/hooks/useControlShortcuts";
import { useStepHandlers } from "@/games/alttpr/hooks/useStepHandlers";
import {
  knownBossCell,
  knownBossShown,
  knownBossText,
} from "@/games/alttpr/logic/knownBosses";
import { dungeonAt, dungeonName } from "@/games/alttpr/logic/settings";
import { STATE_LABELS, useDungeonStatus } from "@/games/alttpr/logic/solution";
import { type Direction, useGameStore } from "@/games/alttpr/stores/gameStore";
import { getAssetPath } from "@/games/alttpr/utils";
import { type GridPosition, useGridFocusable } from "@/hooks/useGridNavigation";

/** Corner of the boss cell an overlay occupies. */
type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

type OverlayProps = {
  corner: Corner;
  /** Asset filename, without the assets/ prefix */
  asset: string;
  /** The control it is, for its keyboard shortcuts, e.g. "chest3" */
  control: ControlId;
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
  control,
  label,
  position,
  step,
  testId,
}: OverlayProps) => (
  <button
    {...useGridFocusable(position)}
    {...useStepHandlers(step, useControlShortcuts(control).aria)}
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
  const status = useDungeonStatus(dungeonAt(index));
  const handleItemClick = useGameStore((state) => state.handleItemClick);

  return (
    <Overlay
      asset={`chest${remaining}.png`}
      control={`chest${index}`}
      corner="bottom-left"
      label={`${dungeonName(index)} chests: ${remaining} left${remaining ? `, ${STATE_LABELS[status]}` : ""}`}
      position={{ col, row, slot: 3 }}
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
      control={`reward${index}`}
      corner="bottom-right"
      label={`${dungeonName(index)} reward: ${REWARD_LABELS[reward]}`}
      position={{ col, row, slot: 4 }}
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
  const stepMedallion = useGameStore((state) => state.stepMedallion);

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
      control={`medallion${index}`}
      corner="top-right"
      label={`${dungeonName(index)} medallion: ${MEDALLION_LABELS[medallion]}`}
      position={{ col, row, slot: 2 }}
      step={(direction) => stepMedallion(index, direction)}
      testId={`medallion-overlay-${index}`}
    />
  );
};

/**
 * The boss a dungeon holds under boss shuffle (top left): not known, then
 * each boss its slot can hold, drawn as its sprite. Nothing is drawn while
 * the run's bosses stay home, nor for a swordless Ice Palace.
 * @param index - The dungeon index (0-9)
 */
export const KnownBossPicker = ({ index, row, col }: CornerProps) => {
  const control = knownBossCell(index);
  const value = useGameStore((state) => Number(state.items[control] ?? 0));
  const shown = useGameStore((state) => knownBossShown(index, state.settings));
  const handleItemClick = useGameStore((state) => state.handleItemClick);
  if (!shown) return null;
  return (
    <Overlay
      // The ten bosses' sprites, in the pack's order (boss02.png to boss92.png)
      asset={value === 0 ? "medallion0.png" : `boss${value - 1}2.png`}
      control={control}
      corner="top-left"
      label={`${dungeonName(index)} boss: ${knownBossText(value)}`}
      position={{ col, row, slot: 1 }}
      step={(direction) => handleItemClick(control, direction)}
      testId={`known-boss-overlay-${index}`}
    />
  );
};
