import type { OverworldEntrance } from "@alltp/pack-alttpr";
import { memo, useId, useState } from "react";
import { poolOf, targetById, targetText } from "@/logic/entrances";
import { useEntrancePicker } from "@/stores/entrancePickerStore";
import { useGameStore } from "@/stores/gameStore";

/** One entrance: its name, opening the picker, and where it leads. */
const EntranceRow = memo(({ entrance }: { entrance: OverworldEntrance }) => {
  const target = useGameStore((state) => {
    const id = state.entrances[entrance.id];
    return id === undefined ? undefined : targetById(id);
  });
  const pick = useEntrancePicker((state) => state.pick);
  return (
    <li className="entrance-row" data-testid={`entrance-row-${entrance.id}`}>
      <button
        aria-label={`${entrance.label}${entrance.kind === "hole" ? " (hole)" : ""}: ${
          target === undefined
            ? "not known yet"
            : `leads to ${targetText(target)}`
        }. Note where it leads`}
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
  const [query, setQuery] = useState("");
  const searchId = useId();
  const headingId = useId();
  if (pool === null) {
    return (
      <p className="logic-note" data-testid="entrances-panel">
        The tracker has no entrance tables for this world yet.
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
        {words.length > 0 && `, ${shown.length} shown`}
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
