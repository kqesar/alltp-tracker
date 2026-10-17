import type { DungeonId } from "@alltp/pack-alttpr";
import { memo, useCallback, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useShallow } from "zustand/react/shallow";
import { MissingLines } from "@/components/ui/Missing";
import { useMissing } from "@/hooks/useRunAnalysis";
import {
  type Check,
  checkStates,
  isCleared,
  runZones,
  type Zone,
} from "@/logic/checks";
import {
  dungeonCount,
  type MarkerState,
  useDungeonStatus,
} from "@/logic/solution";
import { useGameStore } from "@/stores/gameStore";

/** The states the list filters on, in the legend's order, with its words. */
const FILTERS: readonly { state: MarkerState; label: string }[] = [
  { label: "Available", state: "available" },
  { label: "Maybe", state: "possible" },
  { label: "Seen", state: "seen" },
  { label: "Out of logic", state: "unavailable" },
  { label: "Checked", state: "opened" },
];

const LABELS = Object.fromEntries(
  FILTERS.map(({ label, state }) => [state, label]),
) as Record<MarkerState, string>;

/** What the list shows at first: what can be done now, or maybe. */
const FIRST_SHOWN: ReadonlySet<MarkerState> = new Set([
  "available",
  "possible",
]);

/** A state's square with its glyph, as the map draws it. */
const Swatch = ({ state }: { state: MarkerState }) => (
  <span aria-hidden="true" className={`check-swatch state-glyph ${state}`} />
);

/** What a check is missing, once the analysis has it. */
const WhyLines = ({ id }: { id: string }) => (
  <MissingLines missing={useMissing(id)} pending="Working it out…" />
);

/**
 * "Why?": what keeps a check from being available, worked out on demand
 * (a disclosure whose lines span the row under it).
 */
const Why = ({ check }: { check: Check }) => {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  return (
    <>
      <button
        aria-controls={bodyId}
        aria-expanded={open}
        aria-label={`Why? ${check.name}`}
        className="check-why"
        data-testid={`check-why-${check.id}`}
        onClick={() => setOpen(!open)}
        type="button"
      >
        Why?
      </button>
      <div className="check-why__body" hidden={!open} id={bodyId}>
        {open && <WhyLines id={check.id} />}
      </div>
    </>
  );
};

/**
 * One check: a checkbox that checks it, its state in words beside the
 * map's glyph, and for one not available, why.
 * @param cleared - Its dungeon's counter is 0: done, and not to be changed
 */
const CheckRow = memo(
  ({
    check,
    cleared,
    onToggle,
    state,
  }: {
    check: Check;
    cleared: boolean;
    onToggle: (id: string, input: HTMLInputElement) => void;
    state: MarkerState;
  }) => (
    <li className="check-row" data-testid={`check-row-${check.id}`}>
      <label className="check-row__check">
        <input
          checked={state === "opened"}
          className="check-row__input"
          disabled={cleared}
          onChange={(event) => onToggle(check.id, event.currentTarget)}
          type="checkbox"
        />
        <span className="check-row__name">{check.name}</span>
      </label>
      <span className="check-row__state">
        <Swatch state={state} />
        {LABELS[state]}
      </span>
      {state !== "available" && state !== "opened" && <Why check={check} />}
    </li>
  ),
);

/** A dungeon's counter beside its name: the items left and their state. */
const DungeonCount = ({ dungeon }: { dungeon: DungeonId }) => {
  const left = useGameStore((state) => dungeonCount(dungeon, state));
  const state = useDungeonStatus(dungeon);
  if (left === undefined) return null;
  return (
    <span className="checks-zone__count">
      <Swatch state={state} />
      {left === 0
        ? "done"
        : `${left} ${left === 1 ? "item" : "items"} left, ${LABELS[state].toLowerCase()}`}
    </span>
  );
};

/** A zone's heading and its checks shown. */
const ZoneList = ({
  checks,
  cleared,
  onToggle,
  states,
  zone,
}: {
  checks: readonly Check[];
  cleared: boolean;
  onToggle: (id: string, input: HTMLInputElement) => void;
  states: Record<string, MarkerState>;
  zone: Zone;
}) => {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="checks-zone">
      <h3 className="checks-zone__title page-background" id={headingId}>
        {zone.name}
        {zone.dungeon !== undefined && <DungeonCount dungeon={zone.dungeon} />}
      </h3>
      <ul className="checks-zone__list">
        {checks.map((check) => (
          <CheckRow
            check={check}
            cleared={cleared}
            key={check.id}
            onToggle={onToggle}
            state={states[check.id] ?? "unavailable"}
          />
        ))}
      </ul>
    </section>
  );
};

/**
 * Every check of the map as a list, by zone: filters by state with their
 * counts, a zone and a search to narrow it, and a summary a screen reader
 * hears as it changes. Checking a row checks it on the map too. A row that
 * a filter then hides hands its focus to the next row.
 */
export const ChecksPanel = () => {
  const zones = useGameStore(runZones);
  const states = useGameStore(useShallow(checkStates));
  const cleared = useGameStore(
    useShallow((state) =>
      runZones(state).map((zone) => isCleared(zone, state)),
    ),
  );
  const toggleChecks = useGameStore((state) => state.toggleChecks);
  const [shown, setShown] = useState(FIRST_SHOWN);
  const [zoneName, setZoneName] = useState("");
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const ids = useId();

  const onToggle = useCallback(
    (id: string, input: HTMLInputElement) => {
      const boxes = () => [
        ...(listRef.current?.querySelectorAll<HTMLInputElement>(
          ".check-row__input:enabled",
        ) ?? []),
      ];
      const at = boxes().indexOf(input);
      flushSync(() => toggleChecks([id]));
      if (input.isConnected) return;
      const left = boxes();
      (left[Math.min(at, left.length - 1)] ?? listRef.current)?.focus();
    },
    [toggleChecks],
  );

  const words = query.trim().toLowerCase();
  const inScope = zones.map((zone) =>
    zoneName !== "" && zone.name !== zoneName
      ? []
      : zone.checks.filter(
          (check) =>
            words === "" ||
            `${zone.name} ${check.name}`.toLowerCase().includes(words),
        ),
  );
  const counts = Object.fromEntries(FILTERS.map(({ state }) => [state, 0]));
  for (const check of inScope.flat()) counts[states[check.id]]++;
  const lists = inScope.map((checks) =>
    checks.filter((check) => shown.has(states[check.id] ?? "unavailable")),
  );
  const total = lists.reduce((sum, checks) => sum + checks.length, 0);

  const toggleFilter = (state: MarkerState) =>
    setShown((current) => {
      const next = new Set(current);
      if (!next.delete(state)) next.add(state);
      return next;
    });

  return (
    <section
      aria-labelledby={`${ids}-title`}
      className="checks"
      data-testid="checks-panel"
    >
      <h2 className="sr-only" id={`${ids}-title`}>
        Checks
      </h2>
      <div className="checks__tools">
        <fieldset className="segmented checks__filters">
          <legend className="segmented__legend">Show</legend>
          {FILTERS.map(({ label, state }) => (
            <label className="segmented__option checks-filter" key={state}>
              <input
                checked={shown.has(state)}
                className="segmented__input"
                data-testid={`checks-filter-${state}`}
                onChange={() => toggleFilter(state)}
                type="checkbox"
              />
              <Swatch state={state} />
              {label}
              <span className="checks-filter__count">{counts[state]}</span>
            </label>
          ))}
        </fieldset>
        <label className="checks__field">
          <span className="checks__field-label">Zone</span>
          <select
            className="checks__input"
            data-testid="checks-zone"
            onChange={(event) => setZoneName(event.target.value)}
            value={zoneName}
          >
            <option value="">All zones</option>
            {zones.map((zone) => (
              <option key={zone.name} value={zone.name}>
                {zone.name}
              </option>
            ))}
          </select>
        </label>
        <label className="checks__field">
          <span className="checks__field-label">Search</span>
          <input
            className="checks__input"
            data-testid="checks-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name or zone"
            type="search"
            value={query}
          />
        </label>
      </div>
      <p className="checks__summary" data-testid="checks-summary" role="status">
        {total === 0
          ? "No check to show: change the filters above."
          : `${total} ${total === 1 ? "check" : "checks"} shown`}
      </p>
      <div className="checks__zones" ref={listRef} tabIndex={-1}>
        {zones.map((zone, index) =>
          lists[index].length === 0 ? null : (
            <ZoneList
              checks={lists[index]}
              cleared={cleared[index] ?? false}
              key={zone.name}
              onToggle={onToggle}
              states={states}
              zone={zone}
            />
          ),
        )}
      </div>
    </section>
  );
};
