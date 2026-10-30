import type { MapMarker, OverworldEntrance } from "@alltp/pack-alttpr";
import { type CSSProperties, memo, useMemo } from "react";
import {
  MapDungeon,
  MapLocation,
} from "@/games/alttpr/components/map/MapMarkers";
import {
  entranceById,
  entranceText,
  layoutOf,
  placeMarkers,
  poolOf,
  shownNotes,
  swapText,
  targetById,
  targetText,
} from "@/games/alttpr/logic/entrances";
import { useEntrancePicker } from "@/games/alttpr/stores/entrancePickerStore";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { toWorldPosition, type World } from "@/games/alttpr/utils";
import { useTooltip } from "@/hooks/useTooltip";
import { mergeHandlers } from "@/utils/mergeHandlers";

/**
 * One shuffled entrance on the map: a round marker, hollow while where it
 * leads is not known, filled by the kind of place once noted, its ring
 * dotted where another's note tells it (Swapped's partner). A click opens
 * the destination picker.
 */
const EntranceMarker = memo(
  ({
    at,
    entrance,
  }: {
    at: { x: number; y: number };
    entrance: OverworldEntrance;
  }) => {
    const target = useGameStore((state) => {
      const pool = poolOf(state.settings);
      const id =
        pool === null
          ? undefined
          : shownNotes(pool, state.entrances).notes[entrance.id];
      return id === undefined ? undefined : targetById(id);
    });
    const from = useGameStore((state) => {
      const pool = poolOf(state.settings);
      const id =
        pool === null
          ? undefined
          : shownNotes(pool, state.entrances).derived.get(entrance.id);
      return id === undefined ? undefined : entranceById(id);
    });
    const pick = useEntrancePicker((state) => state.pick);
    const link = useEntrancePicker((state) => state.link);
    const place = target?.place;
    const linked = useEntrancePicker(
      (state) => place !== undefined && state.linked === place,
    );
    const tooltip = useTooltip({
      kind: "text",
      text:
        target === undefined
          ? "Not known yet: click to note where it leads"
          : `Leads to ${targetText(target)}${from === undefined ? "" : `, ${swapText(from)}`}`,
      title: `${entrance.label}${entrance.kind === "hole" ? " (hole)" : ""}`,
    });
    // Where layoutEntrances draws it: by its door, clear of its neighbours
    const position = toWorldPosition(`${at.x}%`, `${at.y}%`);
    const style = {
      "--x": `${position.x}%`,
      "--y": `${position.y}%`,
    } as CSSProperties;

    // Pointing at a noted entrance shows the others into the same place
    const handlers = mergeHandlers(tooltip, {
      onBlur: () => link(null),
      onFocus: () => link(place ?? null),
      onPointerEnter: () => link(place ?? null),
      onPointerLeave: () => link(null),
    });

    return (
      <button
        {...handlers}
        aria-label={entranceText(entrance, target, from)}
        className={`mapspan entrance-marker entrance-marker--${entrance.kind} entrance-marker--${target?.kind ?? "unknown"}${from === undefined ? "" : " entrance-marker--told"}${linked ? " entrance-marker--linked" : ""}`}
        data-testid={`entrance-${entrance.id}`}
        onClick={() => pick(entrance.id)}
        style={style}
        type="button"
      />
    );
  },
);

/** A marker as the map draws it: a location's (or a cave's), or a dungeon's. */
const Marker = ({ marker }: { marker: MapMarker }) =>
  marker.dungeon === undefined ? (
    <MapLocation marker={marker} />
  ) : (
    <MapDungeon dungeon={marker.dungeon} marker={marker} />
  );

/**
 * A world in a run whose entrances are shuffled: its markers, each check
 * inside a place the shuffle mixes standing above the door noted to lead
 * there (`placeMarkers`), and its shuffled entrances. Without tables for
 * the run's world (Inverted), its markers as they are. Loaded on demand,
 * with the entrance randomizer's tables.
 * @param world - The half of the map it draws in
 * @param markers - The run's markers, both worlds': a place's may stand in
 *   either, by the door noted
 */
const EntranceLayer = ({
  markers,
  world,
}: {
  markers: readonly MapMarker[];
  world: World;
}) => {
  const pool = useGameStore((state) => poolOf(state.settings));
  // The notes made and those they tell: a place told stands above its door
  const noted = useGameStore((state) => {
    const run = poolOf(state.settings);
    return run === null
      ? state.entrances
      : shownNotes(run, state.entrances).notes;
  });
  const placed = useMemo(
    () => (pool === null ? markers : placeMarkers(pool, noted, markers)),
    [pool, noted, markers],
  );
  const here = placed.filter(
    (marker) => toWorldPosition(`${marker.x}%`, `${marker.y}%`).world === world,
  );
  return (
    <>
      {here.map((marker) => (
        <Marker key={marker.id} marker={marker} />
      ))}
      {pool?.entrances
        .filter((entrance) => entrance.world === world)
        .map((entrance) => (
          <EntranceMarker
            at={layoutOf(pool).get(entrance.id) ?? entrance}
            entrance={entrance}
            key={entrance.id}
          />
        ))}
    </>
  );
};

export default EntranceLayer;
