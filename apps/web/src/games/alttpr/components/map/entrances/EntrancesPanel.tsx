import type { OverworldEntrance } from "@alltp/pack-alttpr";
import { memo, useId, useState } from "react";
import { ENTRANCE_LABELS } from "@/games/alttpr/data/presets";
import {
  entranceById,
  entranceText,
  poolOf,
  shownNotes,
  swapText,
  targetById,
  targetText,
} from "@/games/alttpr/logic/entrances";
import { useEntrancePicker } from "@/games/alttpr/stores/entrancePickerStore";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

/**
 * One entrance: its name, opening the picker, and where it leads, noted or
 * told by another's note (Swapped's partner), which it then says.
 */
const EntranceRow = memo(({ entrance }: { entrance: OverworldEntrance }) => {
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
  return (
    <li className="entrance-row" data-testid={`entrance-row-${entrance.id}`}>
      <button
        aria-label={`${entranceText(entrance, target, from)}. Note where it leads`}
        className="entrance-row__name"
        onClick={() => pick(entrance.id)}
        type="button"
      >
        {entrance.label}
        {entrance.kind === "hole" && (
          <span className="entrance-row__hole"> (hole)</span>
        )}
      </button>
      <span
        aria-hidden="true"
        className={`entrance-row__target${target === undefined ? " entrance-row__target--unknown" : ""}`}
      >
        {target === undefined ? "?" : targetText(target)}
        {from !== undefined && (
          <span
            className="entrance-row__from"
            data-testid={`entrance-told-${entrance.id}`}
          >
            {swapText(from)}
          </span>
        )}
      </span>
    </li>
  );
});

const WORLDS = [
  { id: "light", name: "Light World" },
  { id: "dark", name: "Dark World" },
] as const;

/**
 * Every shuffled entrance as a list, by world, its destination beside it:
 * a search narrows it, and a summary says how many are noted. A row opens
 * the destination picker, as the map's marker does. Loaded on demand.
 */
const EntrancesPanel = () => {
  const pool = useGameStore((state) => poolOf(state.settings));
  const noted = useGameStore((state) => Object.keys(state.entrances).length);
  // Swapped's partners, which the notes tell
  const told = useGameStore((state) => {
    const run = poolOf(state.settings);
    return run === null ? 0 : shownNotes(run, state.entrances).derived.size;
  });
  const shuffle = useGameStore((state) => state.settings.entranceShuffle);
  const mode = useGameStore((state) => state.settings.mode);
  // A Door Randomizer run's every shuffle has its pool: none while the
  // shuffle is not known (a Mystery's)
  const doorRun = useGameStore(
    (state) => state.settings.randomizer !== undefined,
  );
  const [query, setQuery] = useState("");
  const searchId = useId();
  const headingId = useId();
  if (pool === null && doorRun) {
    return (
      <p className="logic-note" data-testid="entrances-panel">
        The entrance shuffle is not known yet: set it in Mode to list its
        entrances.
      </p>
    );
  }
  if (pool === null) {
    return (
      <p className="logic-note" data-testid="entrances-panel">
        The {ENTRANCE_LABELS[shuffle]} entrance shuffle
        {mode === "inverted" ? " in the Inverted world" : ""} is not modelled
        yet: the tracker lists the entrances of the Simple, Restricted, Full and
        Crossworld shuffles in the Open, Retro and Standard worlds.
      </p>
    );
  }
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = pool.entrances.filter((entrance) =>
    words.every((word) => entrance.label.toLowerCase().includes(word)),
  );
  return (
    <div className="entrances" data-testid="entrances-panel">
      <label className="checks__field" htmlFor={searchId}>
        <span className="checks__field-label">Search</span>
        <input
          autoComplete="off"
          className="checks__input"
          id={searchId}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Entrance name"
          type="search"
          value={query}
        />
      </label>
      <p
        className="entrances__summary"
        data-testid="entrances-summary"
        role="status"
      >
        {noted} of {pool.entrances.length} entrances noted
        {told > 0 && `, ${told} more told by their swaps`}
        {words.length > 0 && `, ${shown.length} shown`}
      </p>
      <p className="entrances__hint">
        Autotracking notes each door you go through, outside Race Mode.
        {pool.derived !== undefined &&
          " Swapped doors trade places two by two: noting one door tells where its partner leads."}
      </p>
      {WORLDS.map((world) => {
        const list = shown.filter((entrance) => entrance.world === world.id);
        if (list.length === 0) return null;
        return (
          <section
            aria-labelledby={`${headingId}-${world.id}`}
            className="entrances__world"
            key={world.id}
          >
            <h3
              className="entrances__heading page-background"
              id={`${headingId}-${world.id}`}
            >
              {world.name}
            </h3>
            <ul className="entrances__list">
              {[...list]
                .sort((a, b) => a.label.localeCompare(b.label))
                .map((entrance) => (
                  <EntranceRow entrance={entrance} key={entrance.id} />
                ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
};

export default EntrancesPanel;
