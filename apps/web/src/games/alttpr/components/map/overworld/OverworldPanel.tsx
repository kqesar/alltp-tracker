import { memo, useId } from "react";
import {
  OWR_WHIRLPOOLS,
  overworldShufflesOf,
  whirlpoolTargetsOf,
} from "@/games/alttpr/data/doorRando";
import { FLUTE_SCREENS, fluteScreenName } from "@/games/alttpr/data/owrScreens";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

/** The flute's eight spots (shuffle_flute_spots, FluteShuffle.py:54). */
const FLUTE_SPOTS = 8;

/** A whirlpool: where it leads, among its pool's, noted both ways. */
const WhirlpoolRow = memo(({ name }: { name: string }) => {
  const target = useGameStore((state) => state.overworld.whirlpools?.[name]);
  const noteOverworld = useGameStore((state) => state.noteOverworld);
  const settings = useGameStore((state) => state.settings);
  // A note the run's pools no longer offer (its settings changed) stays shown
  const pool = whirlpoolTargetsOf(name, settings);
  const targets =
    target === undefined || pool.includes(target) ? pool : [...pool, target];
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

/**
 * An Overworld Randomizer run's shuffled overworld, noted by hand: where
 * each whirlpool leads (a note pairs both ways, as the fork links them) and
 * the screens its eight flute spots stand on. Nothing here is read from the
 * game. Loaded on demand.
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
  const pools = Object.keys(notes.whirlpools ?? {}).length;
  const said = [
    ...(shuffles.whirlpools
      ? [`${pools} of ${OWR_WHIRLPOOLS.length} whirlpools noted`]
      : []),
    ...(shuffles.flute
      ? [`${flute.length} of ${FLUTE_SPOTS} flute spots noted`]
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
        whirlpool or the flute takes you. A whirlpool or flute spot not noted
        leads nowhere.
      </p>
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
    </div>
  );
};

export default OverworldPanel;
