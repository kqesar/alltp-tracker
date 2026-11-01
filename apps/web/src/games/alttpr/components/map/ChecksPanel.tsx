import type { DungeonId } from "@alltp/pack-alttpr";
import { memo, useCallback, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useShallow } from "zustand/react/shallow";
import {
  MissingGroups,
  MissingLines,
  TrickWays,
} from "@/games/alttpr/components/ui/Missing";
import { TricksDialog } from "@/games/alttpr/components/ui/TricksDialog";
import {
  useCurrentAnalysis,
  useMissing,
} from "@/games/alttpr/hooks/useRunAnalysis";
import {
  type Check,
  checkStates,
  isCleared,
  runZones,
  type Zone,
} from "@/games/alttpr/logic/checks";
import { rupeesText, withRupees } from "@/games/alttpr/logic/costs";
import { dungeonMissing } from "@/games/alttpr/logic/missing";
import {
  bossStateOf,
  dungeonCount,
  type MarkerState,
  marginShown,
  solutionOf,
  tricksShown,
  useDungeonStatus,
} from "@/games/alttpr/logic/solution";
import { type LogicWords, useLogicWords } from "@/games/alttpr/logic/words";
import { useInReview, useLocationHeld } from "@/games/alttpr/review/labels";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { getAssetPath } from "@/games/alttpr/utils";

/** The states the list filters on, in the legend's order, with its words. */
const FILTERS: readonly { state: MarkerState; label: string }[] = [
  { label: "Available", state: "available" },
  { label: "Maybe", state: "possible" },
  { label: "Outside margin", state: "margin" },
  { label: "Trick", state: "trick" },
  { label: "Seen", state: "seen" },
  { label: "Out of logic", state: "unavailable" },
  { label: "Checked", state: "opened" },
];

const LABELS = Object.fromEntries(
  FILTERS.map(({ label, state }) => [state, label]),
) as Record<MarkerState, string>;

/** A state's words in the list: a No Logic run's no is "Not reachable". */
const labelOf = (state: MarkerState, words: LogicWords): string =>
  state === "unavailable" ? words.noShort : LABELS[state];

/** What the list shows at first: what can be done now, or maybe. */
const FIRST_SHOWN: ReadonlySet<MarkerState> = new Set([
  "available",
  "possible",
]);

/** A state's square with its glyph, as the map draws it. */
const Swatch = ({ state }: { state: MarkerState }) => (
  <span aria-hidden="true" className={`check-swatch state-glyph ${state}`} />
);

/** The states with nothing left to say: done, or in logic. */
const SETTLED: ReadonlySet<MarkerState> = new Set(["available", "opened"]);

/**
 * What a check is missing, once the analysis has it, with the tricks that
 * open it linked to their guides and a way to read about them all.
 */
const WhyLines = ({ id }: { id: string }) => {
  const missing = useMissing(id);
  const [about, setAbout] = useState(false);
  return (
    <>
      <MissingLines guides missing={missing} pending="Working it out…" />
      {missing?.tricks && (
        <>
          <button
            className="check-why"
            data-testid={`check-about-tricks-${id}`}
            onClick={() => setAbout(true)}
            type="button"
          >
            About tricks
          </button>
          <TricksDialog isOpen={about} onClose={() => setAbout(false)} />
        </>
      )}
    </>
  );
};

/**
 * The tricks that open a check out of logic, under its name, so the list
 * says which without its "Why?": "Fake flipper". Nothing while the analysis
 * is pending. Mounted for a row in the trick state alone, so the other rows
 * never follow the analysis.
 */
const TrickNames = ({ id }: { id: string }) => {
  const tricks = useMissing(id)?.tricks;
  if (tricks === undefined) return null;
  return (
    <span className="check-row__trick" data-testid={`check-trick-${id}`}>
      <span className="sr-only">, doable with</span> <TrickWays ways={tricks} />
    </span>
  );
};

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
        aria-label={`Why? ${withRupees(check.name, check.cost)}`}
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
 * @param explained - The run's logic is modelled, so a state has a why
 */
const CheckRow = memo(
  ({
    check,
    cleared,
    explained,
    onToggle,
    state,
  }: {
    check: Check;
    cleared: boolean;
    explained: boolean;
    onToggle: (id: string, input: HTMLInputElement) => void;
    state: MarkerState;
  }) => {
    const held = useLocationHeld(check.id);
    const words = useLogicWords();
    return (
      <li className="check-row" data-testid={`check-row-${check.id}`}>
        <label className="check-row__check">
          <input
            checked={state === "opened"}
            className="check-row__input"
            disabled={cleared}
            onChange={(event) => onToggle(check.id, event.currentTarget)}
            type="checkbox"
          />
          <span className="check-row__name">
            {check.name}
            {check.cost !== undefined && (
              <>
                {" "}
                <span className="check-row__cost">
                  ({rupeesText(check.cost)})
                </span>
              </>
            )}
          </span>
          {held && (
            <span
              className="check-row__held"
              data-testid={`check-held-${check.id}`}
            >
              <span className="sr-only">, held </span>
              {held.icon !== null && (
                <img
                  alt=""
                  className="check-row__sprite"
                  height={20}
                  src={getAssetPath(held.icon)}
                  width={20}
                />
              )}
              {held.name}
            </span>
          )}
          {state === "trick" && <TrickNames id={check.id} />}
        </label>
        <span className="check-row__state">
          <Swatch state={state} />
          {labelOf(state, words)}
        </span>
        {explained &&
          !check.door &&
          state !== "available" &&
          state !== "opened" && <Why check={check} />}
      </li>
    );
  },
);

/** A dungeon's counter beside its name: the items left and their state. */
const DungeonCount = ({ dungeon }: { dungeon: DungeonId }) => {
  const left = useGameStore((state) => dungeonCount(dungeon, state));
  const state = useDungeonStatus(dungeon);
  const words = useLogicWords();
  if (left === undefined) return null;
  return (
    <span className="checks-zone__count">
      <Swatch state={state} />
      {left === 0
        ? "no item left"
        : `${left} ${left === 1 ? "item" : "items"} left, ${labelOf(state, words).toLowerCase()}`}
    </span>
  );
};

/**
 * What a dungeon's checks left are missing, grouped by what they miss: the
 * run's analysis, so "Working it out…" until it is in.
 */
const ZoneMissing = ({
  boss,
  dungeon,
  states,
  zone,
}: {
  boss: MarkerState | undefined;
  dungeon: DungeonId;
  states: Record<string, MarkerState>;
  zone: Zone;
}) => {
  const analysis = useCurrentAnalysis();
  if (analysis === undefined) {
    return <p className="missing missing--pending">Working it out…</p>;
  }
  const groups = dungeonMissing(
    zone.checks.map(({ id, name }) => ({
      id,
      label: name,
      state: states[id] ?? "unavailable",
    })),
    dungeon,
    boss,
    analysis,
  );
  return groups.length === 0 ? (
    <p className="missing missing--pending">Nothing is missing.</p>
  ) : (
    <MissingGroups groups={groups} guides />
  );
};

/** A zone's heading and its checks shown. */
const ZoneList = ({
  checks,
  cleared,
  explained,
  onToggle,
  states,
  zone,
}: {
  checks: readonly Check[];
  cleared: boolean;
  explained: boolean;
  onToggle: (id: string, input: HTMLInputElement) => void;
  states: Record<string, MarkerState>;
  zone: Zone;
}) => {
  const headingId = useId();
  const bodyId = useId();
  const [open, setOpen] = useState(false);
  const { dungeon } = zone;
  // Hyrule Castle has no boss: its prize is Zelda's
  const boss = useGameStore((state) =>
    dungeon === undefined || dungeon === "hyrule-castle"
      ? undefined
      : bossStateOf(dungeon, state),
  );
  // Every check of the dungeon counts, whatever the filters show
  const worthAsking =
    dungeon !== undefined &&
    explained &&
    (zone.checks.some(({ id }) => !SETTLED.has(states[id] ?? "unavailable")) ||
      (boss !== undefined && !SETTLED.has(boss)));
  return (
    <section aria-labelledby={headingId} className="checks-zone">
      <div className="checks-zone__head page-background">
        <h3 className="checks-zone__title" id={headingId}>
          {zone.name}
          {dungeon !== undefined && <DungeonCount dungeon={dungeon} />}
        </h3>
        {worthAsking && (
          <button
            aria-controls={bodyId}
            aria-expanded={open}
            aria-label={`What's missing? ${zone.name}`}
            className="check-why"
            data-testid={`zone-why-${dungeon}`}
            onClick={() => setOpen(!open)}
            type="button"
          >
            What's missing?
          </button>
        )}
      </div>
      {worthAsking && (
        <div
          className="checks-zone__missing"
          data-testid={`zone-missing-${dungeon}`}
          hidden={!open}
          id={bodyId}
        >
          {open && (
            <ZoneMissing
              boss={boss}
              dungeon={dungeon}
              states={states}
              zone={zone}
            />
          )}
        </div>
      )}
      <ul className="checks-zone__list">
        {checks.map((check) => (
          <CheckRow
            check={check}
            cleared={cleared}
            explained={explained}
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
  // Under logic the pack does not model, no check has a why (LogicNote);
  // nor while a crossed run's logic is still loading
  const explained = useGameStore((state) => solutionOf(state).modelled);
  const cleared = useGameStore(
    useShallow((state) =>
      runZones(state).map((zone) => isCleared(zone, state)),
    ),
  );
  const toggleChecks = useGameStore((state) => state.toggleChecks);
  const { noShort } = useLogicWords();
  // The Trick and Outside margin filters exist while the map marks them
  const tricksOn = useGameStore(tricksShown);
  const marginOn = useGameStore(marginShown);
  const [shown, setShown] = useState(FIRST_SHOWN);
  const [zoneName, setZoneName] = useState("");
  const [query, setQuery] = useState("");
  // In a review: every check left undone, whatever the state filters say
  const inReview = useInReview();
  const [missedOnly, setMissedOnly] = useState(false);
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
  const filters = FILTERS.filter(
    ({ state }) =>
      (tricksOn || state !== "trick") && (marginOn || state !== "margin"),
  );
  const counts = Object.fromEntries(FILTERS.map(({ state }) => [state, 0]));
  for (const check of inScope.flat()) counts[states[check.id]]++;
  const unfiltered = inReview && missedOnly;
  const lists = inScope.map((checks) =>
    checks.filter((check) =>
      unfiltered
        ? states[check.id] !== "opened"
        : shown.has(states[check.id] ?? "unavailable"),
    ),
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
          {filters.map(({ label, state }) => (
            <label className="segmented__option checks-filter" key={state}>
              <input
                checked={shown.has(state)}
                className="segmented__input"
                data-testid={`checks-filter-${state}`}
                onChange={() => toggleFilter(state)}
                type="checkbox"
              />
              <Swatch state={state} />
              {state === "unavailable" ? noShort : label}
              <span className="checks-filter__count">{counts[state]}</span>
            </label>
          ))}
        </fieldset>
        {inReview && (
          <label className="segmented__option checks-filter checks__missed">
            <input
              checked={missedOnly}
              className="segmented__input"
              data-testid="checks-missed-only"
              onChange={(event) => setMissedOnly(event.target.checked)}
              type="checkbox"
            />
            Missed only
          </label>
        )}
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
              explained={explained}
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
