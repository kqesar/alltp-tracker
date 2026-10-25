// The overlay API must never tell a stream what a racer keeps from it. These
// tests hold each game's whitelist to that with fully loaded runs: a full
// inventory and the goals done, so the go mode and the objectives have
// something to give away, then every secret-bearing slice changed, and the
// reading compared with the one before. A new field in a store cannot reach
// the API unless someone changes a whitelist, its pinned id list, and these
// tests.

import { MAP_LOCATIONS } from "@alltp/pack-alttpr";
import { ITEMS as SMZ3_ITEMS } from "@alltp/pack-smz3";
import { describe, expect, it } from "vitest";
import { itemsMax } from "@/games/alttpr/data/items";
import {
  type AlttprRun,
  overlayReadingOf as alttpr,
  OVERLAY_ITEMS,
} from "@/games/alttpr/overlay";
import { createProgress } from "@/games/alttpr/stores/gameStore";
import { overlayReadingOf as sm } from "@/games/sm/overlay";
import { freshProgress as smFresh } from "@/games/sm/store";
import { overlayReadingOf as smz3 } from "@/games/smz3/overlay";
import { freshProgress as smz3Fresh } from "@/games/smz3/store";
import type { OverlayState } from "@/overlay/protocol";
import { IDLE_TIMER, startTimer } from "@/utils/runTimer";

const SENTINEL = "SECRET-SENTINEL";

/** The keys a state has, and nothing else may be added to it. */
const STATE_KEYS = ["game", "goMode", "items", "objectives", "timer"];
const ITEM_KEYS = ["id", "level", "max", "name"];
const OBJECTIVE_KEYS = ["done", "id", "ms", "name"];
const TIMER_KEYS = ["elapsedMs", "startedAt", "state"];

/** Words no id, name or key of a state may hold: what races keep secret. */
const FORBIDDEN =
  /check|chest|prize|reward|pendant|crystal|entrance|setting|preset|seed|hash|bigkey|smallkey|key(?!s)|compass|map(?!s)|keycard|shop|location|goal(?!Mode)|token/i;

const shapeOf = (state: OverlayState) => {
  expect(Object.keys(state).sort()).toEqual(STATE_KEYS);
  for (const item of state.items) {
    expect(Object.keys(item).sort()).toEqual(ITEM_KEYS);
  }
  for (const objective of state.objectives) {
    expect(Object.keys(objective).sort()).toEqual(OBJECTIVE_KEYS);
  }
  if (state.timer) expect(Object.keys(state.timer).sort()).toEqual(TIMER_KEYS);
};

const wordsOf = (state: OverlayState): string[] => [
  ...state.items.flatMap(({ id, name }) => [id, name]),
  ...state.objectives.flatMap(({ id, name }) => [id, name]),
];

describe("what the overlay API never sends", () => {
  describe("A Link to the Past", () => {
    /**
     * A run that holds every item the API names, with the first five bosses
     * and Agahnim beaten and the others alive: the go mode and the objectives
     * are then worked out from a real position, not an empty one.
     */
    const loaded = (preset: string): AlttprRun => {
      const base = createProgress(preset);
      const items: Record<string, number | boolean> = { ...base.items };
      for (const [, key] of OVERLAY_ITEMS) items[key] = itemsMax[key] ?? true;
      for (let boss = 0; boss < 10; boss++) {
        items[`boss${boss}`] = boss < 5 ? 2 : 1;
        // The prize marked on a dungeon: beaten ones keep theirs
        items[`reward${boss}`] = boss < 5 ? 1 + (boss % 4) : 0;
      }
      items.agahnim = 1;
      return {
        ...base,
        items: items as AlttprRun["items"],
        timeline: {},
        timer: startTimer(IDLE_TIMER, 1_000),
      };
    };

    const locations = Object.keys(MAP_LOCATIONS).filter(
      // The bomb merchant's check stands for the bomb: an item, held
      (id) => id !== "bomb-merchant",
    );

    /**
     * Everything a racer keeps from a stream, changed: where the checks are,
     * the entrances noted, the medallions the pads want, the small keys, the
     * big keys, maps and compasses, the chests left, the shops, and the prizes
     * marked on the dungeons whose boss is not beaten.
     */
    const noisy = (run: AlttprRun): AlttprRun => {
      const items: Record<string, number | boolean> = { ...run.items };
      for (let dungeon = 0; dungeon < 10; dungeon++) {
        items[`bigkey${dungeon}`] = 1;
        items[`map${dungeon}`] = 1;
        items[`compass${dungeon}`] = 1;
        items[`chest${dungeon}`] = 0;
        // A prize on a dungeon not beaten yet is what the player knows of
        // the seed, not what they hold
        if (items[`boss${dungeon}`] === 1) items[`reward${dungeon}`] = 4;
      }
      return {
        ...run,
        checked: Object.fromEntries(locations.map((id) => [id, true as const])),
        entrances: { [SENTINEL]: `${SENTINEL}-target` },
        items: {
          ...items,
          shoparrow: true,
          shopkey: true,
        } as unknown as AlttprRun["items"],
        medallions: Array(10).fill(3) as number[],
        smallKeys: Array(13).fill(9) as number[],
        timeline: {},
      };
    };

    it("says the same of a run whatever the secrets it holds", () => {
      const run = loaded("open");
      const reading = alttpr(run);
      // The comparison has something to give away: a go mode worked out
      expect(reading.state.goMode).not.toBeNull();
      expect(reading.state.objectives.filter((o) => o.done)).toHaveLength(6);
      expect(alttpr(noisy(run))).toEqual(reading);
    });

    it("says the same under a run type that tracks small keys", () => {
      // Keysanity: the keys held feed the logic, so they may move the go
      // mode; what must not move it is everything else
      const run = loaded("keysanity");
      const { smallKeys: keys } = run;
      expect(alttpr({ ...noisy(run), smallKeys: keys })).toEqual(alttpr(run));
    });

    it("moves the go mode only with what the player holds", () => {
      const run = loaded("open");
      const none = { ...run.items };
      for (const [, key] of OVERLAY_ITEMS) none[key] = false;
      // Items taken away: the go mode follows, as it should
      expect(
        alttpr({ ...run, items: none as AlttprRun["items"] }).state.goMode,
      ).toBe("no");
    });

    it("holds nothing but the whitelisted shape and words", () => {
      const { state } = alttpr(noisy(loaded("open")));
      shapeOf(state);
      expect(JSON.stringify(state)).not.toContain(SENTINEL);
      for (const word of wordsOf(state)) {
        expect(word).not.toMatch(FORBIDDEN);
      }
    });
  });

  describe("Super Metroid", () => {
    it("says the same of a full run whatever the options that change the grid", () => {
      const fresh = smFresh();
      const run = {
        ...fresh,
        done: ["kraid", "phantoon", "draygon", "ridley"],
        items: Object.fromEntries(
          Object.entries(fresh.items).map(([id]) => [id, 1]),
        ),
        // A field the whitelist does not read, as a store may grow one
        [SENTINEL]: "x",
        // The clock's frames before the run, which the timer is set on
        clockBase: 987_654,
        splitSpeed: true,
        timer: IDLE_TIMER,
        timerClock: "game",
        wallJump: true,
      } as unknown as Parameters<typeof sm>[0];
      const { state } = sm(run);
      shapeOf(state);
      expect(JSON.stringify(state)).not.toContain(SENTINEL);
      expect(state.objectives.every(({ done }) => done)).toBe(true);
      expect(state.timer).toEqual({
        elapsedMs: 0,
        startedAt: null,
        state: "idle",
      });
      expect(JSON.stringify(state)).not.toContain("987654");
      expect(state.goMode).toBeNull();
      expect(sm(run)).toEqual(
        sm({ ...run, splitSpeed: false, wallJump: false }),
      );
    });
  });

  describe("SMZ3", () => {
    it("says the same of a full run whatever the secrets it holds", () => {
      const fresh = smz3Fresh();
      const full = Object.fromEntries(
        SMZ3_ITEMS.map(({ id, max }) => [id, max]),
      );
      const loaded = {
        ...fresh,
        checked: ["secret-location"],
        items: full,
        pads: { mire: "bombos", turtleRock: "quake" },
        settings: { ...fresh.settings, keysanity: true },
        timer: IDLE_TIMER,
        timerClock: "game",
      } as unknown as Parameters<typeof smz3>[0];
      const { state } = smz3(loaded);
      shapeOf(state);
      for (const word of wordsOf(state)) {
        expect(word).not.toMatch(FORBIDDEN);
      }
      // Keys, keycards, rewards and the tokens are never named, held or not
      const ids = state.items.map(({ id }) => id);
      for (const secret of [
        "keyCT",
        "keyPD",
        "pendantGreen",
        "crystalRed",
        "tokenKraid",
        "cardCrateriaL1",
      ]) {
        expect(ids).not.toContain(secret);
      }
      expect(state.objectives).toEqual([]);
      expect(state.timer).toEqual({
        elapsedMs: 0,
        startedAt: null,
        state: "idle",
      });
      expect(JSON.stringify(state)).not.toContain("secret-location");
      expect(smz3(loaded)).toEqual(
        smz3({
          ...loaded,
          checked: [],
          items: {
            ...loaded.items,
            ...Object.fromEntries(
              SMZ3_ITEMS.filter(({ id }) => !ids.includes(id)).map(({ id }) => [
                id,
                0,
              ]),
            ),
          },
          pads: { mire: "unknown", turtleRock: "unknown" },
          settings: { ...loaded.settings, keysanity: false },
        }),
      );
    });
  });
});
