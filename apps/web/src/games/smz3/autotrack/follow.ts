// The SMZ3 run following the game, for one autotracking session: each
// reading's news laid on the run as the game's (no undo step), towards
// progress only, as the other boards follow theirs (games/sm/autotrack/
// follow.ts). Nothing is laid while the running game is not in play.
//
// - An item takes the game's count when that count changes, or more if the
//   player marked more: the game never takes back a find.
// - A location the game says checked is checked; one it does not stays as
//   the player left it.
// - The settings the ROM states (Super Metroid's logic, keysanity) and,
//   outside races, its requirements and medallions follow the seed.

import type { Smz3Settings } from "@alltp/pack-smz3";
import type { Smz3Reading } from "@/games/smz3/autotrack/reading";
import {
  type Smz3Pads,
  type Smz3Progress,
  useSmz3Store,
} from "@/games/smz3/store";

/** What the game says, kept to tell news from what it said before. */
type View = {
  items: Readonly<Record<string, number>>;
  checked: ReadonlySet<string>;
  settings: Partial<Smz3Settings>;
  pads: Partial<Smz3Pads>;
};

/** The entries whose value memory told: none null or undefined. */
const known = <T extends object>(
  entries: {
    [K in keyof T]?: T[K] | null;
  },
): Partial<T> =>
  Object.fromEntries(
    Object.entries(entries).filter(([, value]) => value != null),
  ) as Partial<T>;

const viewOf = (reading: Smz3Reading): View => {
  const seed = typeof reading.seed === "string" ? null : reading.seed;
  const asked =
    typeof reading.requirements === "string" ? null : reading.requirements;
  return {
    checked: new Set(
      typeof reading.checked === "string" ? [] : reading.checked,
    ),
    items: typeof reading.items === "string" ? {} : reading.items,
    pads: known<Smz3Pads>({
      mire: asked?.mire,
      turtleRock: asked?.turtleRock,
    }),
    settings: known<Smz3Settings>({
      ganonCrystals: asked?.ganonCrystals,
      keysanity: seed?.keysanity,
      smLogic: seed?.smLogic,
      tourianBosses: asked?.tourianBosses,
      towerCrystals: asked?.towerCrystals,
    }),
  };
};

/** The entries of `now` that are new to `before`. */
const newIn = <T extends object>(now: T, before: T | undefined) =>
  Object.fromEntries(
    Object.entries(now).filter(
      ([key, value]) =>
        before === undefined || before[key as keyof T] !== value,
    ),
  ) as Partial<T>;

/** Start following the game, for a new session. */
export const createSmz3Follower = () => {
  let shown: View | null = null;
  return {
    /** Lay a reading's news on the run. */
    read: (reading: Smz3Reading) => {
      if (reading.inPlay !== true) return;
      const now = viewOf(reading);
      const before = shown;
      shown = now;
      const itemNews = Object.entries(newIn(now.items, before?.items));
      const checkNews = [...now.checked].filter(
        (id) => before === null || !before.checked.has(id),
      );
      const settingNews = newIn(now.settings, before?.settings);
      const padNews = newIn(now.pads, before?.pads);
      if (
        itemNews.length === 0 &&
        checkNews.length === 0 &&
        Object.keys(settingNews).length === 0 &&
        Object.keys(padNews).length === 0
      ) {
        return;
      }
      useSmz3Store.getState().applyGameNews((run) => {
        const change: Partial<Smz3Progress> = {};
        if (itemNews.length > 0) {
          const items = { ...run.items };
          for (const [id, count] of itemNews) {
            items[id] = Math.max(items[id] ?? 0, count ?? 0);
          }
          change.items = items;
        }
        if (checkNews.length > 0) {
          change.checked = [...new Set([...run.checked, ...checkNews])];
        }
        if (Object.keys(settingNews).length > 0) {
          change.settings = { ...run.settings, ...settingNews };
        }
        if (Object.keys(padNews).length > 0) {
          change.pads = { ...run.pads, ...padNews };
        }
        return change;
      });
    },
  };
};
