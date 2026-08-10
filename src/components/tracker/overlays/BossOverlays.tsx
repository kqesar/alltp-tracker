import { useGameStore } from "@/stores/gameStore";
import { getAssetPath } from "@/utils";

/** Corner of the boss cell an overlay occupies. */
type Corner = "top-right" | "bottom-left" | "bottom-right";

type OverlayProps = {
  corner: Corner;
  /** Asset filename, without the assets/ prefix */
  asset: string;
  onActivate: () => void;
  testId?: string;
};

/**
 * Shared presentation for the small icons layered onto a boss cell. Clicks are
 * stopped from reaching the boss button underneath.
 */
const Overlay = ({ corner, asset, onActivate, testId }: OverlayProps) => (
  <div
    className={`overlay-base overlay--${corner}`}
    data-testid={testId}
    onClick={(event) => {
      event.stopPropagation();
      onActivate();
    }}
    style={{ backgroundImage: `url(${getAssetPath(asset)})` }}
  />
);

/** Which item family a counter overlay cycles, and how it is drawn. */
const COUNTERS = {
  chest: { asset: "chest", corner: "bottom-left" },
  reward: { asset: "dungeon", corner: "bottom-right" },
} as const;

type CounterOverlayProps = {
  bossNumber: number;
  kind: keyof typeof COUNTERS;
};

/**
 * Renders one of the two counters attached to a boss: the remaining chests in
 * the dungeon (bottom left) or the boss reward (bottom right).
 * @param bossNumber - The boss number (0-9)
 * @param kind - Which counter to render
 */
export const CounterOverlay = ({ bossNumber, kind }: CounterOverlayProps) => {
  const { items, handleItemClick } = useGameStore();
  const { asset, corner } = COUNTERS[kind];
  const itemKey = `${kind}${bossNumber}`;

  return (
    <Overlay
      asset={`${asset}${items[itemKey] as number}.png`}
      corner={corner}
      onActivate={() => handleItemClick(itemKey)}
      testId={`${kind}-overlay-${bossNumber}`}
    />
  );
};

/** Number of medallion states: unknown, Bombos, Ether, Quake. */
const MEDALLION_STATES = 4;

/**
 * Renders the medallion requirement for the two Dark World dungeons gated
 * behind one (Misery Mire and Turtle Rock). Nothing is drawn for the others.
 * @param bossNumber - The boss number (0-9)
 */
export const MedaillonOverlay = ({ bossNumber }: { bossNumber: number }) => {
  const { medallions, handleMedallionChange } = useGameStore();

  if (bossNumber < 8) return null;

  const medallion = medallions[bossNumber];

  return (
    <Overlay
      // Modulo keeps a malformed imported value pointing at a real asset.
      asset={`medallion${medallion % MEDALLION_STATES}.png`}
      corner="top-right"
      onActivate={() =>
        handleMedallionChange(bossNumber, (medallion + 1) % MEDALLION_STATES)
      }
    />
  );
};
