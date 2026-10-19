import {
  type DungeonId,
  LEGACY_DUNGEONS,
  type MapMarker,
} from "@alltp/pack-alttpr";
import type { CSSProperties } from "react";
import {
  dungeonCount,
  STATE_LABELS,
  useBossStatus,
  useMarkerStatus,
} from "@/games/alttpr/logic/solution";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { useTooltip } from "@/hooks/useTooltip";
import { getAssetPath, toWorldPosition } from "@/utils";

/** The medallion each value of the store's `medallions` names. */
const MEDALLION_NAMES = ["unknown", "Bombos", "Ether", "Quake"];

/** Position, icon and sizing variables shared by every marker. */
const markerStyle = (
  marker: MapMarker,
  asset: string,
): CSSProperties & Record<"--x" | "--y", string> => {
  const position = toWorldPosition(`${marker.x}%`, `${marker.y}%`);
  return {
    "--x": `${position.x}%`,
    "--y": `${position.y}%`,
    backgroundImage: `url(${getAssetPath(asset)})`,
  };
};

/**
 * A marker standing for one location or several (a cave's chests). Clicking
 * it checks them all, or none once all are.
 * @param marker - The pack's marker
 */
export const MapLocation = ({ marker }: { marker: MapMarker }) => {
  const state = useMarkerStatus(marker.id);
  const toggleChecks = useGameStore((store) => store.toggleChecks);
  const tooltip = useTooltip({ id: marker.id, kind: "marker" });
  const count = marker.locations.length;

  return (
    <button
      {...tooltip}
      aria-label={`${marker.name}${count > 1 ? ` (${count} checks)` : ""}: ${STATE_LABELS[state]}`}
      aria-pressed={state === "opened"}
      className={`mapspan chest state-glyph ${state}`}
      data-testid={`marker-${marker.id}`}
      onClick={() => toggleChecks(marker.locations)}
      style={markerStyle(marker, "poi.png")}
      type="button"
    />
  );
};

/** The control that marks a dungeon's boss beaten: its grid cell's. */
const bossControl = (id: DungeonId): string => {
  const index = (LEGACY_DUNGEONS as readonly string[]).indexOf(id);
  if (index >= 0) return `boss${index}`;
  return id === "castle-tower" ? "agahnim" : "agahnim2";
};

/** The boss's portrait: the grid's, or Agahnim's for his two towers. */
const bossArt = (id: DungeonId): string => {
  const index = (LEGACY_DUNGEONS as readonly string[]).indexOf(id);
  return index >= 0 ? `boss${index}2.png` : "agahnim1.png";
};

/**
 * A dungeon: a square showing what its counter has left in logic, under the
 * boss icon, the button, which shows whether the boss can be beaten.
 * Clicking it marks the boss beaten, the same flag as the grid's boss cell
 * (Agahnim's for Castle Tower).
 * @param marker - The pack's marker of the dungeon
 * @param dungeon - Its dungeon
 */
export const MapDungeon = ({
  dungeon,
  marker,
}: {
  dungeon: DungeonId;
  marker: MapMarker;
}) => {
  const squareState = useMarkerStatus(marker.id);
  const bossState = useBossStatus(dungeon);
  const left = useGameStore((store) => dungeonCount(dungeon, store));
  const medallion = useGameStore((store) =>
    dungeon === "misery-mire"
      ? store.medallions[8]
      : dungeon === "turtle-rock"
        ? store.medallions[9]
        : undefined,
  );
  const handleItemClick = useGameStore((store) => store.handleItemClick);
  const tooltip = useTooltip({ id: marker.id, kind: "marker" });

  const pad =
    medallion === undefined
      ? ""
      : `, ${MEDALLION_NAMES[medallion % MEDALLION_NAMES.length] ?? "unknown"} medallion`;
  const counter =
    left === undefined
      ? squareState === "opened"
        ? "no item to find"
        : `its chests ${STATE_LABELS[squareState]}`
      : `${left === 1 ? "1 chest" : `${left} chests`} left (${STATE_LABELS[squareState]})`;
  const beaten = bossState === "opened";

  return (
    <>
      <div
        aria-hidden="true"
        className={`mapspan dungeon state-glyph ${squareState}`}
        data-testid={`dungeon-marker-${dungeon}`}
        onPointerEnter={tooltip.onPointerEnter}
        onPointerLeave={tooltip.onPointerLeave}
        style={markerStyle(marker, "poi.png")}
      />
      <button
        {...tooltip}
        aria-label={`${marker.name}${pad}: boss ${STATE_LABELS[bossState]}, ${counter}`}
        aria-pressed={beaten}
        className={`mapspan boss state-glyph ${bossState}`}
        data-testid={`boss-marker-${dungeon}`}
        onClick={() => handleItemClick(bossControl(dungeon))}
        style={markerStyle(marker, bossArt(dungeon))}
        type="button"
      />
    </>
  );
};
