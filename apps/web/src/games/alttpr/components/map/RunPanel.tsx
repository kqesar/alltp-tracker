import { playTimeMs, type RomStats } from "@alltp/pack-alttpr";
import { memo, useId, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { checkStates } from "@/games/alttpr/logic/checks";
import {
  type Find,
  findIcon,
  findName,
  findsOf,
  type Split,
  splitsOf,
} from "@/games/alttpr/logic/runLog";
import { formatTime, isRunning, timerMs } from "@/games/alttpr/logic/timer";
import { useAutotrackStore } from "@/games/alttpr/stores/autotrackStore";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { getAssetPath } from "@/games/alttpr/utils";
import { useNow } from "@/hooks/useNow";

/** The bosses a run beats: the grid's ten and the two Agahnims. */
const BOSS_COUNT = 12;

/**
 * A run time: a `<time>` with its duration, or a dash, said as "before the
 * timer", for what was found before the timer started.
 */
const RunTime = ({ ms }: { ms: number | null }) =>
  ms === null ? (
    <span className="run-time run-time--none" title="Before the timer started">
      <span aria-hidden="true">–</span>
      <span className="sr-only">before the timer</span>
    </span>
  ) : (
    <time className="run-time" dateTime={`PT${Math.floor(ms / 1000)}S`}>
      {formatTime(ms)}
    </time>
  );

/** The timer's time, redrawn each second while it runs. */
const TimerTime = () => {
  const timer = useGameStore((state) => state.timer);
  const now = useNow(isRunning(timer));
  return <>{formatTime(timerMs(timer, now))}</>;
};

/** How many bosses the board has beaten. */
const bossesBeaten = (items: Record<string, boolean | number>): number =>
  Array.from({ length: 10 }, (_, index) => items[`boss${index}`]).filter(
    (value) => value === 2,
  ).length +
  Number(items.agahnim === 1) +
  Number(items.agahnim2 === 1);

/** The run at a glance: its time, its checks done, its bosses beaten. */
const Summary = () => {
  const states = useGameStore(useShallow(checkStates));
  const bosses = useGameStore((state) => bossesBeaten(state.items));
  const all = Object.values(states);
  const done = all.filter((state) => state === "opened").length;
  return (
    <dl className="run-summary" data-testid="run-summary">
      <div className="run-summary__item">
        <dt>Time</dt>
        <dd>
          <TimerTime />
        </dd>
      </div>
      <div className="run-summary__item">
        <dt>Checks</dt>
        <dd>
          {done}
          <span className="run-summary__of"> of {all.length}</span>
        </dd>
      </div>
      <div className="run-summary__item">
        <dt>Bosses</dt>
        <dd>
          {bosses}
          <span className="run-summary__of"> of {BOSS_COUNT}</span>
        </dd>
      </div>
    </dl>
  );
};

/**
 * The bosses in the order they fell, with the run's time and the segment
 * since the one before, then the goal once the timer stopped there.
 */
const Splits = ({ splits }: { splits: readonly Split[] }) => {
  const timer = useGameStore((state) => state.timer);
  const titleId = useId();
  // The goal's segment runs from the last boss, or from the start
  const last = splits.length === 0 ? 0 : (splits.at(-1)?.ms ?? null);
  return (
    <section
      aria-labelledby={titleId}
      className="run-section"
      data-testid="run-splits"
    >
      <h3 className="run-section__title" id={titleId}>
        Splits
      </h3>
      {splits.length === 0 && !timer.finished ? (
        <p className="run-section__empty">
          Each boss beaten splits the run here.
        </p>
      ) : (
        <table aria-labelledby={titleId} className="run-splits">
          <thead>
            <tr>
              <th scope="col">Dungeon</th>
              <th scope="col">Time</th>
              <th scope="col">Segment</th>
            </tr>
          </thead>
          <tbody>
            {splits.map((split) => (
              <tr data-testid={`split-${split.key}`} key={split.key}>
                <th scope="row">{split.name}</th>
                <td>
                  <RunTime ms={split.ms} />
                </td>
                <td>
                  <RunTime ms={split.segment} />
                </td>
              </tr>
            ))}
            {timer.finished && (
              <tr className="run-splits__goal" data-testid="split-goal">
                <th scope="row">Goal</th>
                <td>
                  <RunTime ms={timer.elapsedMs} />
                </td>
                <td>
                  <RunTime ms={last === null ? null : timer.elapsedMs - last} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </section>
  );
};

/** One find: its time, its image (or a location's tick) and its name. */
const FindRow = memo(({ find }: { find: Find }) => {
  const icon = findIcon(find.key);
  return (
    <li className="run-find" data-testid={`find-${find.key}`}>
      <RunTime ms={find.stamp.ms} />
      {icon === null ? (
        <span aria-hidden="true" className="run-find__check">
          ✓
        </span>
      ) : (
        <img
          alt=""
          className="run-find__icon"
          height={24}
          src={getAssetPath(icon)}
          width={24}
        />
      )}
      <span className="run-find__name">{findName(find.key)}</span>
    </li>
  );
});

/** Every find of the run, newest first. */
const Finds = ({ finds }: { finds: readonly Find[] }) => {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="run-section run-finds"
      data-testid="run-finds"
    >
      <h3 className="run-section__title" id={titleId}>
        Timeline{" "}
        <span className="run-section__count">
          {finds.length}{" "}
          <span className="sr-only">
            {finds.length === 1 ? "find" : "finds"}
          </span>
        </span>
      </h3>
      {finds.length === 0 ? (
        <p className="run-section__empty">
          Each item found and location checked lands here, timed by the run
          timer.
        </p>
      ) : (
        <ol aria-label="Timeline" className="run-finds__list">
          {finds.map((find) => (
            <FindRow find={find} key={find.key} />
          ))}
        </ol>
      )}
    </section>
  );
};

/** The swords bosses fell to, in the credits' order, and their names. */
const KILL_NAMES = [
  ["swordless", "swordless"],
  ["fighter", "fighter"],
  ["master", "master"],
  ["tempered", "tempered"],
  ["gold", "golden"],
] as const;

/** The bosses killed with each sword, those with any: "2 master, 1 tempered". */
const bossKills = (kills: RomStats["bossKills"]): string =>
  KILL_NAMES.filter(([sword]) => kills[sword] > 0)
    .map(([sword, name]) => `${kills[sword]} ${name}`)
    .join(", ") || "0";

/** Frames as a time, or a dash for a count still at 0. */
const framesTime = (frames: number): string =>
  frames === 0 ? "–" : formatTime(playTimeMs(frames));

/** The ROM's stats, as its end credits list them (stats/statConfig.asm). */
const STAT_ROWS: readonly (readonly [string, (stats: RomStats) => string])[] = [
  ["First sword", (stats) => framesTime(stats.found.sword)],
  ["Pegasus Boots", (stats) => framesTime(stats.found.boots)],
  ["Flute", (stats) => framesTime(stats.found.flute)],
  ["Mirror", (stats) => framesTime(stats.found.mirror)],
  ["Boss kills", (stats) => bossKills(stats.bossKills)],
  ["Damage taken", (stats) => String(stats.damageTaken)],
  ["Magic used", (stats) => String(stats.magicUsed)],
  ["Bonks", (stats) => String(stats.bonks)],
  ["Save and quits", (stats) => String(stats.saveAndQuits)],
  ["Deaths", (stats) => String(stats.deaths)],
  ["Faerie revivals", (stats) => String(stats.faerieRevivals)],
  ["Menu time", (stats) => formatTime(playTimeMs(stats.menuFrames))],
  ["Lag time", (stats) => formatTime(playTimeMs(stats.lagFrames))],
  ["Items collected", (stats) => String(stats.itemsCollected)],
  ["Play time", (stats) => formatTime(playTimeMs(stats.playFrames))],
];

/**
 * What the ROM says of the game, or why it says nothing: no game read, a
 * race (whose rules forbid these reads), or no file loaded yet (the save
 * data reads 0 until one is).
 */
const useRomStats = (): RomStats | "none" | "race" | "waiting" =>
  useAutotrackStore((state) => {
    const reading = state.reading;
    if (reading === null) return "none";
    if (reading.race) return "race";
    const { goal, romStats, started } = reading.progress;
    if (typeof romStats === "string" || (started !== true && goal !== true)) {
      return "waiting";
    }
    return romStats;
  });

const HINTS = {
  none: "Autotrack a game outside races to see the counts its ROM keeps: when the first sword was found, deaths, menu time and more.",
  race: "Not read in races: the race rules do not permit it.",
  waiting: "Shown once the game is in play.",
} as const;

/** The ROM's own stats, outside races, while the game is in play. */
const FromTheGame = () => {
  const stats = useRomStats();
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="run-section"
      data-testid="run-rom-stats"
    >
      <h3 className="run-section__title" id={titleId}>
        From the game
      </h3>
      {typeof stats === "string" ? (
        <p className="run-section__empty">{HINTS[stats]}</p>
      ) : (
        <dl className="run-stats">
          {STAT_ROWS.map(([label, value]) => (
            <div className="run-stats__row" key={label}>
              <dt>{label}</dt>
              <dd>{value(stats)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
};

/**
 * The Run tab: the run at a glance, its splits, every find with its time
 * (the run's timeline, logic/timeline.ts) and, outside races, the stats the
 * ROM keeps. It follows the board as it changes; only its time ticks.
 */
export const RunPanel = () => {
  const timeline = useGameStore((state) => state.timeline);
  const finds = useMemo(() => findsOf(timeline), [timeline]);
  const splits = useMemo(() => splitsOf(timeline), [timeline]);
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="run" data-testid="run-panel">
      <h2 className="sr-only" id={titleId}>
        Run
      </h2>
      <Summary />
      <div className="run__columns">
        <div className="run__side">
          <Splits splits={splits} />
          <FromTheGame />
        </div>
        <Finds finds={finds} />
      </div>
    </section>
  );
};
