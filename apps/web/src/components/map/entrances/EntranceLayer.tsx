import type { OverworldEntrance } from "@alltp/pack-alttpr";
import { type CSSProperties, memo } from "react";
import { useTooltip } from "@/hooks/useTooltip";
import {
  entranceText,
  poolOf,
  targetById,
  targetText,
} from "@/logic/entrances";
import { useEntrancePicker } from "@/stores/entrancePickerStore";
import { useGameStore } from "@/stores/gameStore";
import { toWorldPosition, type World } from "@/utils";

/**
 * One shuffled entrance on the map: a round marker, hollow while where it
 * leads is not known, filled by the kind of place once noted. A click opens
 * the destination picker.
 */
const EntranceMarker = memo(({ entrance }: { entrance: OverworldEntrance }) => {
  const target = useGameStore((state) => {
    const id = state.entrances[entrance.id];
    return id === undefined ? undefined : targetById(id);
  });
  const pick = useEntrancePicker((state) => state.pick);
  const tooltip = useTooltip({
    kind: "text",
    text:
      target === undefined
        ? "Not known yet: click to note where it leads"
        : `Leads to ${targetText(target)}`,
    title: `${entrance.label}${entrance.kind === "hole" ? " (hole)" : ""}`,
  });
  const position = toWorldPosition(`${entrance.x}%`, `${entrance.y}%`);
  const style = {
    "--x": `${position.x}%`,
    "--y": `${position.y}%`,
  } as CSSProperties;

  return (
    <button
      {...tooltip}
      aria-label={entranceText(entrance, target)}
      className={`mapspan entrance-marker entrance-marker--${entrance.kind} entrance-marker--${target?.kind ?? "unknown"}`}
      data-testid={`entrance-${entrance.id}`}
      onClick={() => pick(entrance.id)}
      style={style}
      type="button"
    />
  );
});

/**
 * A world's shuffled entrances, in a run whose entrances are shuffled: none
 * otherwise, nor in a world the assistant has no tables for (Inverted).
 * Loaded on demand, with the entrance randomizer's tables.
 * @param world - The half of the map it draws in
 */
const EntranceLayer = ({ world }: { world: World }) => {
  const pool = useGameStore((state) => poolOf(state.settings));
  if (pool === null) return null;
  return pool.entrances
    .filter((entrance) => entrance.world === world)
    .map((entrance) => (
      <EntranceMarker entrance={entrance} key={entrance.id} />
    ));
};

export default EntranceLayer;
