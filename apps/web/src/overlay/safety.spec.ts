// The overlay API must never tell a stream what a racer keeps from it. These
// tests hold each game's whitelist to that with a fully loaded run: every
// secret-bearing slice filled with a sentinel, then the reading compared with
// the one of a run without them. A new field in a store cannot reach the API
// unless someone changes a whitelist, its pinned id list, and these tests.

import { MAP_LOCATIONS } from "@alltp/pack-alttpr";
import { describe, expect, it } from "vitest";
import { IDLE_TIMER, startTimer } from "@/games/alttpr/logic/timer";
import { overlayReadingOf as alttpr } from "@/games/alttpr/overlay";
import { createProgress } from "@/games/alttpr/stores/gameStore";
import { overlayReadingOf as sm } from "@/games/sm/overlay";
import { freshProgress as smFresh } from "@/games/sm/store";
import { overlayReadingOf as smz3 } from "@/games/smz3/overlay";
import { freshProgress as smz3Fresh } from "@/games/smz3/store";
import type { OverlayState } from "@/overlay/protocol";

const SENTINEL = "SECRET-SENTINEL";

/** The keys a state has, and nothing else may be added to it. */
const STATE_KEYS = ["game", "goMode", "items", "objectives", "timer"];
const ITEM_KEYS = ["id", "level", "max", "name"];
const OBJECTIVE_KEYS = ["done", "id", "ms", "name"];
const TIMER_KEYS = ["elapsedMs", "startedAt", "state"];

/** Words no id, name or key of a state may hold: what races keep secret. */
const FORBIDDEN =
  /check|chest|prize|reward|pendant|crystal|entrance|setting|preset|seed|hash|bigkey|smallkey|key(?!s)|compass|map(?!s)|keycard|shop|location|goal(?!Mode)/i;

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
    const base = createProgress("keysanity");
    const everything = (() => {
      const everyLocation = Object.fromEntries(
        Object.keys(MAP_LOCATIONS).map((id) => [id, true as const]),
      );
      const items = { ...base.items };
      // Every secret-bearing counter at its fullest
      for (const key of Object.keys(items)) {
        if (/^(bigkey|chest|compass|map|reward|boss)\d+$/.test(key)) {
          items[key] = key.startsWith("boss") ? 1 : 4;
        }
      }
      return {
        ...base,
        checked: { ...everyLocation, [SENTINEL]: true as const },
        entrances: { [SENTINEL]: `${SENTINEL}-target` },
        items: { ...items, shoparrow: true, shopkey: true },
        medallions: Array(10).fill(3) as number[],
        presetId: SENTINEL,
        smallKeys: Array(13).fill(9) as number[],
        timeline: {
          [`check:${SENTINEL}`]: { at: 1, ms: 5 },
        },
        timer: startTimer(IDLE_TIMER, 1_000),
      } as unknown as Parameters<typeof alttpr>[0];
    })();

    it("is the same reading with the run's secrets loaded or not", () => {
      const quiet = {
        ...everything,
        checked: {},
        entrances: {},
        items: {
          ...everything.items,
          ...Object.fromEntries(
            Object.keys(base.items)
              .filter((key) =>
                /^(bigkey|chest|compass|map|reward)\d+$/.test(key),
              )
              .map((key) => [key, base.items[key]]),
          ),
          shoparrow: false,
          shopkey: false,
        },
        medallions: Array(10).fill(0) as number[],
        presetId: "keysanity",
        smallKeys: Array(13).fill(0) as number[],
        timeline: {},
      };
      expect(alttpr(everything)).toEqual(alttpr(quiet));
    });

    it("holds nothing but the whitelisted shape and words", () => {
      const { state } = alttpr(everything);
      shapeOf(state);
      expect(JSON.stringify(state)).not.toContain(SENTINEL);
      for (const word of wordsOf(state)) {
        expect(word).not.toMatch(FORBIDDEN);
      }
    });
  });

  describe("Super Metroid", () => {
    it("reads the items and the seed's objectives, and nothing else", () => {
      const run = {
        ...smFresh(),
        // A field the whitelist does not read, as a store may grow one
        [SENTINEL]: "x",
        splitSpeed: true,
        wallJump: true,
      } as ReturnType<typeof smFresh>;
      const { state } = sm(run);
      shapeOf(state);
      expect(JSON.stringify(state)).not.toContain(SENTINEL);
      expect(state.timer).toBeNull();
      expect(state.goMode).toBeNull();
      expect(sm(run)).toEqual(
        sm({ ...run, splitSpeed: false, wallJump: false }),
      );
    });
  });

  describe("SMZ3", () => {
    it("reads both games' items and the boss tokens, never the rest", () => {
      const fresh = smz3Fresh();
      const loaded = {
        ...fresh,
        checked: ["secret-location"],
        items: {
          ...Object.fromEntries(Object.keys(fresh.items).map((id) => [id, 1])),
          crystalRed: 1,
          keyCT: 2,
          keyPD: 6,
          pendantGreen: 1,
        },
        pads: { mire: "bombos", turtleRock: "quake" },
        settings: { ...fresh.settings, keysanity: true },
      } as unknown as Parameters<typeof smz3>[0];
      const { state } = smz3(loaded);
      shapeOf(state);
      for (const word of wordsOf(state)) {
        expect(word).not.toMatch(FORBIDDEN);
      }
      const ids = state.items.map(({ id }) => id);
      for (const secret of ["keyCT", "keyPD", "pendantGreen", "crystalRed"]) {
        expect(ids).not.toContain(secret);
      }
      expect(JSON.stringify(state)).not.toContain("secret-location");
      // Settings, pads and checks change nothing it says
      expect(smz3(loaded)).toEqual(
        smz3({
          ...loaded,
          checked: [],
          pads: { mire: "unknown", turtleRock: "unknown" },
          settings: { ...loaded.settings, keysanity: false },
        }),
      );
    });
  });
});
