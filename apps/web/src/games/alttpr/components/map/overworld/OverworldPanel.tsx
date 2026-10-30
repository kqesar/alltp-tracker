import { memo, useId } from "react";
import {
  flipGroupsOf,
  forcedWhirlpoolOf,
  OWR_CROSSINGS,
  OWR_WHIRLPOOLS,
  overworldShufflesOf,
  whirlpoolTargetsOf,
} from "@/games/alttpr/data/doorRando";
import {
  FLUTE_SCREENS,
  fluteScreenName,
  screenNameOf,
} from "@/games/alttpr/data/owrScreens";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

/** The flute's eight spots (shuffle_flute_spots, FluteShuffle.py:54). */
const FLUTE_SPOTS = 8;

/** A whirlpool: where it leads, among its pool's, noted both ways. */
const WhirlpoolRow = memo(({ name }: { name: string }) => {
  const target = useGameStore((state) => state.overworld.whirlpools?.[name]);
  const noteOverworld = useGameStore((state) => state.noteOverworld);
  const settings = useGameStore((state) => state.settings);
  const flips = useGameStore((state) => state.overworld.flips);
  // A note the run's pools no longer offer (its settings changed) stays shown
  const pool = whirlpoolTargetsOf(name, settings);
  const targets =
    target === undefined || pool.includes(target) ? pool : [...pool, target];
  // A pair the shuffle leaves no choice for is linked with no note
  const forced = forcedWhirlpoolOf(name, settings, flips);
  if (forced !== undefined)
    return (
      <li className="door-row" data-testid={`whirlpool-row-${name}`}>
        <span className="door-row__name">{name}</span>
        <span className="door-row__link">leads to {forced} (always)</span>
      </li>
    );
  return (
    <li className="door-row" data-testid={`whirlpool-row-${name}`}>
      <span className="door-row__name">{name}</span>
      <select
        aria-label={`${name}: leads to`}
        className="checks__input door-row__link"
        onChange={(event) => {
          const value = event.currentTarget.value;
          noteOverworld({
            whirlpools: { [name]: value === "" ? null : value },
          });
        }}
        value={target ?? ""}
      >
        <option value="">? Not known</option>
        {targets.map((other) => (
          <option key={other} value={other}>
            {other}
          </option>
        ))}
      </select>
    </li>
  );
});

/** A flip's select value: not known, stands, flipped. */
const FLIP_VALUE = { false: "stands", true: "flipped" } as const;

/**
 * A group of screens Mixed flips together: whether it is flipped, noted
 * for every screen of the group.
 */
const FlipRow = memo(({ screens }: { screens: readonly number[] }) => {
  const flips = useGameStore((state) => state.overworld.flips);
  const noteOverworld = useGameStore((state) => state.noteOverworld);
  const noted = new Set(screens.map((screen) => flips?.[String(screen)]));
  const value = noted.size === 1 ? [...noted][0] : undefined;
  const name = screens.map(screenNameOf).join(", ");
  const id = (screens[0] ?? 0).toString(16).padStart(2, "0");
  return (
    <li className="door-row" data-testid={`flip-row-${id}`}>
      <span className="door-row__name">{name}</span>
      <select
        aria-label={`${name}: flipped`}
        className="checks__input door-row__link"
        onChange={(event) => {
          const chosen = event.currentTarget.value;
          const flipped = chosen === "" ? null : chosen === FLIP_VALUE.true;
          noteOverworld({
            flips: Object.fromEntries(
              screens.map((screen) => [String(screen), flipped]),
            ),
          });
        }}
        value={value === undefined ? "" : FLIP_VALUE[`${value}`]}
      >
        <option value="">? Not known</option>
        <option value={FLIP_VALUE.false}>Not flipped</option>
        <option value={FLIP_VALUE.true}>Flipped</option>
      </select>
    </li>
  );
});

/** A crossing's select value: not known, stays, crosses. */
const CROSSING_VALUE = { false: "stays", true: "crosses" } as const;

/**
 * A crossable edge pair of a crossed overworld: whether walking across it
 * leads into the other world (its twins' pair crossing with it).
 */
const CrossingRow = memo(
  ({ edge, partner }: { edge: string; partner: string }) => {
    const crosses = useGameStore((state) => state.overworld.crossings?.[edge]);
    const noteOverworld = useGameStore((state) => state.noteOverworld);
    return (
      <li className="door-row" data-testid={`crossing-row-${edge}`}>
        <span className="door-row__name">
          {edge} – {partner}
        </span>
        <select
          aria-label={`${edge} to ${partner}: world`}
          className="checks__input door-row__link"
          onChange={(event) => {
            const value = event.currentTarget.value;
            noteOverworld({
              crossings: {
                [edge]: value === "" ? null : value === CROSSING_VALUE.true,
              },
            });
          }}
          value={crosses === undefined ? "" : CROSSING_VALUE[`${crosses}`]}
        >
          <option value="">? Not known</option>
          <option value={CROSSING_VALUE.false}>Stays in its world</option>
          <option value={CROSSING_VALUE.true}>Crosses worlds</option>
        </select>
      </li>
    );
  },
);

/**
 * An Overworld Randomizer run's shuffled overworld, noted by hand: where
 * each whirlpool leads (a note pairs both ways, as the fork links them),
 * the screens its eight flute spots stand on, overworld crossed, whether
 * each edge pair crosses into the other world and, overworld mixed, which
 * groups of screens are flipped. Nothing here is read from the game.
 * Loaded on demand.
 */
const OverworldPanel = () => {
  const run = useGameStore((state) => state.settings);
  const notes = useGameStore((state) => state.overworld);
  const noteOverworld = useGameStore((state) => state.noteOverworld);
  const headingId = useId();
  const shuffles = overworldShufflesOf(run);
  if (shuffles === undefined) return null;
  // An Inverted world flips every screen: the bird lands in the dark world
  const flipped = run.mode === "inverted";
  const flute = notes.flute ?? [];
  const pools = OWR_WHIRLPOOLS.filter(
    (name) =>
      notes.whirlpools?.[name] !== undefined ||
      forcedWhirlpoolOf(name, run, notes.flips) !== undefined,
  ).length;
  const crossings = Object.keys(notes.crossings ?? {}).length;
  const groups = flipGroupsOf(run);
  const flipsNoted = groups.filter((group) => {
    const seen = new Set(
      group.screens.map((screen) => notes.flips?.[String(screen)]),
    );
    return seen.size === 1 && !seen.has(undefined);
  }).length;
  const said = [
    ...(shuffles.flips
      ? [`${flipsNoted} of ${groups.length} screen groups noted`]
      : []),
    ...(shuffles.whirlpools
      ? [`${pools} of ${OWR_WHIRLPOOLS.length} whirlpools noted`]
      : []),
    ...(shuffles.flute
      ? [`${flute.length} of ${FLUTE_SPOTS} flute spots noted`]
      : []),
    ...(shuffles.crossings
      ? [`${crossings} of ${OWR_CROSSINGS.length} edge pairs noted`]
      : []),
  ];
  const toggle = (screen: number, on: boolean) =>
    noteOverworld({
      flute: on ? [...flute, screen] : flute.filter((s) => s !== screen),
    });
  return (
    <div className="doors" data-testid="overworld-panel">
      <p
        className="entrances__summary"
        data-testid="overworld-summary"
        role="status"
      >
        {said.join(", ")}
      </p>
      <p className="entrances__hint">
        Note each by hand as you find it: the tracker never reads where a
        whirlpool, the flute or a screen's edge takes you, nor which screens are
        flipped. One not noted leads nowhere.
      </p>
      {shuffles.flips && (
        <section
          aria-labelledby={`${headingId}-flips`}
          className="entrances__world"
        >
          <h3
            className="entrances__heading page-background"
            id={`${headingId}-flips`}
          >
            Screens
          </h3>
          <p className="entrances__hint">
            Mixed flips screens in groups: a flipped screen shows the other
            world's version of itself (the dark world's in the light world).
            While a group is not known, nothing it decides is in logic. The
            screens around the sanctuary never flip with these entrances.
          </p>
          <ul className="entrances__list">
            {groups.map(({ screens }) => (
              <FlipRow key={screens.join("-")} screens={screens} />
            ))}
          </ul>
        </section>
      )}
      {shuffles.whirlpools && (
        <section
          aria-labelledby={`${headingId}-whirlpools`}
          className="entrances__world"
        >
          <h3
            className="entrances__heading page-background"
            id={`${headingId}-whirlpools`}
          >
            Whirlpools
          </h3>
          <ul className="entrances__list">
            {OWR_WHIRLPOOLS.map((name) => (
              <WhirlpoolRow key={name} name={name} />
            ))}
          </ul>
        </section>
      )}
      {shuffles.flute && (
        <section
          aria-labelledby={`${headingId}-flute`}
          className="entrances__world"
        >
          <h3
            className="entrances__heading page-background"
            id={`${headingId}-flute`}
          >
            Flute spots
          </h3>
          <p className="entrances__hint">
            Tick the screens the flute's map offers, up to {FLUTE_SPOTS}.
          </p>
          <ul className="entrances__list overworld__screens">
            {FLUTE_SCREENS.map(([screen, stands, flips]) => {
              const on = flute.includes(screen);
              const name = fluteScreenName(flipped ? flips : stands);
              const id = screen.toString(16).padStart(2, "0");
              return (
                <li className="check-row" key={screen}>
                  <label className="check-row__check">
                    <input
                      checked={on}
                      className="check-row__input"
                      data-testid={`flute-screen-${id}`}
                      disabled={!on && flute.length >= FLUTE_SPOTS}
                      onChange={(event) =>
                        toggle(screen, event.currentTarget.checked)
                      }
                      type="checkbox"
                    />
                    <span className="check-row__name">{name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {shuffles.crossings && (
        <section
          aria-labelledby={`${headingId}-crossings`}
          className="entrances__world"
        >
          <h3
            className="entrances__heading page-background"
            id={`${headingId}-crossings`}
          >
            Edges
          </h3>
          <p className="entrances__hint">
            For each pair of light world screens, whether walking from one to
            the other takes you into the other world; the same pair in the dark
            world crosses with it.
          </p>
          <ul className="entrances__list">
            {OWR_CROSSINGS.map(([edge, partner]) => (
              <CrossingRow edge={edge} key={edge} partner={partner} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default OverworldPanel;
