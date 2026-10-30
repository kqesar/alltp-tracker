// The routing of an Overworld Randomizer seed, held to the seeds the pack's
// contract walks (packs/alttpr/test/owr-spoilers/, its crossed and Mixed
// sets, test/owr-playthrough.
// spec.ts): their permalink read as Start from a seed reads it, the run it
// switches to is solved in the fork's own world, on the settings that world
// was held to there (its mode, its bonk drops, DR 1.5.7, the goal).
import { avianartReading } from "@alltp/pack-alttpr";
import { describe, expect, it } from "vitest";
import { checkSeed } from "@/games/alttpr/autotrack/seed";
import {
  doorLogic,
  getPreset,
  unmodelledReasons,
} from "@/games/alttpr/data/presets";
import { drSettingsOf } from "@/games/alttpr/logic/settings";
import unrestricted from "../../../../../../packs/alttpr/test/owr-crossed-spoilers/avianart-0DsyCwK23.json?raw";
import grouped from "../../../../../../packs/alttpr/test/owr-crossed-spoilers/avianart-o4mamwuKZ.json?raw";
import mixedGrouped from "../../../../../../packs/alttpr/test/owr-mixed-spoilers/avianart-4yKJq5H2E.json?raw";
import mixedInverted from "../../../../../../packs/alttpr/test/owr-mixed-spoilers/avianart-6DIwXjzG5.json?raw";
import mixed from "../../../../../../packs/alttpr/test/owr-mixed-spoilers/avianart-mPEeiQvu1.json?raw";
import mixedWhirlpools from "../../../../../../packs/alttpr/test/owr-mixed-spoilers/avianart-t8B3wJpHK.json?raw";
import open from "../../../../../../packs/alttpr/test/owr-spoilers/avianart-2cWVkb9pK.json?raw";
import openBonks from "../../../../../../packs/alttpr/test/owr-spoilers/avianart-n7Bg53tbm.json?raw";
import inverted from "../../../../../../packs/alttpr/test/owr-spoilers/avianart-nir3EmS5u.json?raw";
import invertedBonks from "../../../../../../packs/alttpr/test/owr-spoilers/avianart-rcEzGOnFN.json?raw";

const SEEDS = [
  ["n7Bg53tbm", openBonks, false, true],
  ["2cWVkb9pK", open, false, false],
  ["rcEzGOnFN", invertedBonks, true, true],
  ["nir3EmS5u", inverted, true, false],
  ["o4mamwuKZ", grouped, false, false],
  ["0DsyCwK23", unrestricted, false, false],
  ["mPEeiQvu1", mixed, false, false],
  ["6DIwXjzG5", mixedInverted, true, false],
  ["4yKJq5H2E", mixedGrouped, false, false],
  ["t8B3wJpHK", mixedWhirlpools, false, false],
] as const;

describe("an Overworld Randomizer seed started from its permalink", () => {
  it.each(SEEDS)(
    "is solved in the fork's world as the contract holds it (%s)",
    (hash, raw, invertedMode, bonkDrops) => {
      const reading = avianartReading(
        { response: { spoiler: JSON.parse(raw), type: "dr" } },
        hash,
      );
      if (reading === null) throw new Error(`${hash}: no reading`);
      const check = checkSeed(reading, {
        presetId: "open",
        settings: getPreset("open").settings,
      });
      if (check.kind !== "differs") throw new Error(`${hash}: ${check.kind}`);
      const run = check.settings;
      expect(run).toMatchObject({
        bombBag: false,
        customGoals: false,
        prizeShuffle: "none",
        randomizer: "owr",
        shuffleFollowers: false,
      });
      expect(unmodelledReasons(run)).toEqual([]);
      expect(doorLogic(run)).toBe(true);
      expect(drSettingsOf(run)).toMatchObject({
        bombBag: false,
        bonkDrops,
        crystalsGanon: 7,
        crystalsTower: 7,
        drVersion: 157,
        invertedMode,
      });
    },
  );
});
