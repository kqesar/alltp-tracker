// The routing of an Overworld Randomizer seed, held to the seeds the pack's
// contract walks (packs/alttpr/test/owr-spoilers/, its crossed, Mixed and
// shuffled entrances sets, test/owr-playthrough.
// spec.ts): their permalink read as Start from a seed reads it, the run it
// switches to is solved in the fork's own world, on the settings that world
// was held to there (its mode, its bonk drops, DR 1.5.7, the goal).
import { avianartReading } from "@alltp/pack-alttpr";
import { keyHoldingOf } from "@alltp/pack-alttpr/door-world";
import { describe, expect, it } from "vitest";
import { checkSeed } from "@/games/alttpr/autotrack/seed";
import { doorShuffleSettingsOf } from "@/games/alttpr/data/doorRando";
import {
  doorLogic,
  entrancesKnown,
  getPreset,
  keyCellsShown,
  unmodelledReasons,
} from "@/games/alttpr/data/presets";
import { drSettingsOf } from "@/games/alttpr/logic/settings";
import unrestricted from "../../../../../../packs/alttpr/test/owr-crossed-spoilers/avianart-0DsyCwK23.json?raw";
import grouped from "../../../../../../packs/alttpr/test/owr-crossed-spoilers/avianart-o4mamwuKZ.json?raw";
import doorsCrossed from "../../../../../../packs/alttpr/test/owr-door-spoilers/avianart-0tUGDpve7.json?raw";
import doorsEntrances from "../../../../../../packs/alttpr/test/owr-door-spoilers/avianart-61u7cpluY.json?raw";
import doorsMixed from "../../../../../../packs/alttpr/test/owr-door-spoilers/avianart-CTRTq1Rhj.json?raw";
import doorsPartitioned from "../../../../../../packs/alttpr/test/owr-door-spoilers/avianart-kxnOoGUE9.json?raw";
import doorsBasic from "../../../../../../packs/alttpr/test/owr-door-spoilers/avianart-nrVetY8I2.json?raw";
import doorsCrossed3 from "../../../../../../packs/alttpr/test/owr-door-spoilers/avianart-pSf43q0bF.json?raw";
import doorsInverted from "../../../../../../packs/alttpr/test/owr-door-spoilers/avianart-tIJDkPsK3.json?raw";
import doorsStandard from "../../../../../../packs/alttpr/test/owr-door-spoilers/avianart-uVQOPwIvs.json?raw";
import doorsDecoupled from "../../../../../../packs/alttpr/test/owr-door-spoilers/avianart-x1FHBuUpu.json?raw";
import lite from "../../../../../../packs/alttpr/test/owr-entrance-spoilers/avianart-1IAKwFudE.json?raw";
import liteInverted from "../../../../../../packs/alttpr/test/owr-entrance-spoilers/avianart-4cwdgebPq.json?raw";
import full from "../../../../../../packs/alttpr/test/owr-entrance-spoilers/avianart-89uvVx2xg.json?raw";
import insanity from "../../../../../../packs/alttpr/test/owr-entrance-spoilers/avianart-DLSrm8B0f.json?raw";
import dungeonsSimple from "../../../../../../packs/alttpr/test/owr-entrance-spoilers/avianart-ERKxf6EjS.json?raw";
import lean from "../../../../../../packs/alttpr/test/owr-entrance-spoilers/avianart-jRN0n0tst.json?raw";
import simple from "../../../../../../packs/alttpr/test/owr-entrance-spoilers/avianart-jUsfGyWR1.json?raw";
import crossedEdges from "../../../../../../packs/alttpr/test/owr-entrance-spoilers/avianart-kL7bNLknt.json?raw";
import districtMixed from "../../../../../../packs/alttpr/test/owr-entrance-spoilers/avianart-p5dYMs8jC.json?raw";
import district from "../../../../../../packs/alttpr/test/owr-entrance-spoilers/avianart-qzj33CUOO.json?raw";
import swappedKeys from "../../../../../../packs/alttpr/test/owr-entrance-spoilers/avianart-sbuwNOmVF.json?raw";
import swapped from "../../../../../../packs/alttpr/test/owr-entrance-spoilers/avianart-sLcpC6Z45.json?raw";
import dungeonsFull from "../../../../../../packs/alttpr/test/owr-entrance-spoilers/avianart-tZeE1P1Du.json?raw";
import crossedMixed from "../../../../../../packs/alttpr/test/owr-entrance-spoilers/avianart-uegcykSHR.json?raw";
import crossedInverted from "../../../../../../packs/alttpr/test/owr-entrance-spoilers/avianart-waofX3504.json?raw";
import crossed from "../../../../../../packs/alttpr/test/owr-entrance-spoilers/avianart-xq1iZJVwM.json?raw";
import restricted from "../../../../../../packs/alttpr/test/owr-entrance-spoilers/avianart-zXFy19ljb.json?raw";
import mixedGrouped from "../../../../../../packs/alttpr/test/owr-mixed-spoilers/avianart-4yKJq5H2E.json?raw";
import mixedInverted from "../../../../../../packs/alttpr/test/owr-mixed-spoilers/avianart-6DIwXjzG5.json?raw";
import mixed from "../../../../../../packs/alttpr/test/owr-mixed-spoilers/avianart-mPEeiQvu1.json?raw";
import mixedWhirlpools from "../../../../../../packs/alttpr/test/owr-mixed-spoilers/avianart-t8B3wJpHK.json?raw";
import open from "../../../../../../packs/alttpr/test/owr-spoilers/avianart-2cWVkb9pK.json?raw";
import openBonks from "../../../../../../packs/alttpr/test/owr-spoilers/avianart-n7Bg53tbm.json?raw";
import inverted from "../../../../../../packs/alttpr/test/owr-spoilers/avianart-nir3EmS5u.json?raw";
import invertedBonks from "../../../../../../packs/alttpr/test/owr-spoilers/avianart-rcEzGOnFN.json?raw";
import standardDungeons from "../../../../../../packs/alttpr/test/owr-standard-spoilers/avianart-0pr3QtXLU.json?raw";
import standardBonks from "../../../../../../packs/alttpr/test/owr-standard-spoilers/avianart-0rrVwugI5.json?raw";
import standard from "../../../../../../packs/alttpr/test/owr-standard-spoilers/avianart-AjT8OHdZc.json?raw";
import standardLite from "../../../../../../packs/alttpr/test/owr-standard-spoilers/avianart-CK14WlYnG.json?raw";
import standardCrossed from "../../../../../../packs/alttpr/test/owr-standard-spoilers/avianart-mGEeueUjZ.json?raw";
import standardMixed from "../../../../../../packs/alttpr/test/owr-standard-spoilers/avianart-mhKQq39uX.json?raw";

const SEEDS = [
  ["n7Bg53tbm", openBonks, false, true],
  ["sLcpC6Z45", swapped, false, false],
  ["sbuwNOmVF", swappedKeys, false, false],
  ["qzj33CUOO", district, false, false],
  ["p5dYMs8jC", districtMixed, false, false],
  ["xq1iZJVwM", crossed, false, false],
  ["uegcykSHR", crossedMixed, false, false],
  ["kL7bNLknt", crossedEdges, false, false],
  ["waofX3504", crossedInverted, true, false],
  ["1IAKwFudE", lite, false, false],
  ["4cwdgebPq", liteInverted, true, false],
  ["jRN0n0tst", lean, false, false],
  ["jUsfGyWR1", simple, false, false],
  ["zXFy19ljb", restricted, false, false],
  ["89uvVx2xg", full, false, false],
  ["DLSrm8B0f", insanity, false, false],
  ["ERKxf6EjS", dungeonsSimple, false, false],
  ["tZeE1P1Du", dungeonsFull, false, false],
  ["2cWVkb9pK", open, false, false],
  ["rcEzGOnFN", invertedBonks, true, true],
  ["nir3EmS5u", inverted, true, false],
  ["o4mamwuKZ", grouped, false, false],
  ["0DsyCwK23", unrestricted, false, false],
  ["mPEeiQvu1", mixed, false, false],
  ["6DIwXjzG5", mixedInverted, true, false],
  ["4yKJq5H2E", mixedGrouped, false, false],
  ["t8B3wJpHK", mixedWhirlpools, false, false],
  ["nrVetY8I2", doorsBasic, false, false],
  ["kxnOoGUE9", doorsPartitioned, false, false],
  ["0tUGDpve7", doorsCrossed, false, false],
  ["pSf43q0bF", doorsCrossed3, false, false],
  ["tIJDkPsK3", doorsInverted, true, false],
  ["CTRTq1Rhj", doorsMixed, false, false],
  ["61u7cpluY", doorsEntrances, false, false],
  ["uVQOPwIvs", doorsStandard, false, false],
  ["x1FHBuUpu", doorsDecoupled, false, false],
  ["AjT8OHdZc", standard, false, false],
  ["0rrVwugI5", standardBonks, false, true],
  ["mhKQq39uX", standardMixed, false, false],
  ["mGEeueUjZ", standardCrossed, false, false],
  ["0pr3QtXLU", standardDungeons, false, false],
  ["CK14WlYnG", standardLite, false, false],
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
        // The fork's release its meta names (versions.Overworld 0.8.0.2-u)
        owrVersion: "0.8.0.2",
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
      // The fork's own entrance shuffles: its pool on the Entrances tab,
      // its rules' `shuffle_<mode>`; its Standard world
      const { mode, shuffle, ...meta } = (
        JSON.parse(raw) as {
          meta: {
            mode: string;
            shuffle: string;
            door_shuffle: string;
            intensity: number;
            decoupledoors: boolean;
          };
        }
      ).meta;
      // The fork's door shuffle, as its world reads it
      const doors = doorShuffleSettingsOf(run);
      expect(doors?.shuffle ?? "vanilla").toBe(meta.door_shuffle);
      if (doors !== undefined)
        expect([doors.intensity, doors.decoupled]).toEqual([
          meta.intensity,
          meta.decoupledoors,
        ]);
      expect(drSettingsOf(run).standardMode === true).toBe(mode === "standard");
      expect(entrancesKnown(run)).toBe(shuffle !== "vanilla");
      expect(drSettingsOf(run)).toMatchObject(
        shuffle === "vanilla" ? {} : { [`shuffle_${shuffle}`]: true },
      );
    },
  );

  it("sets a Swapped seed with small keys alone wild up on the board, the rest kept", () => {
    // DR's options are apart (args.json): keyshuffle wild, big keys, maps
    // and compasses in their dungeons, which no level of alttpr.com's is
    const reading = avianartReading(
      { response: { spoiler: JSON.parse(swappedKeys), type: "dr" } },
      "sbuwNOmVF",
    );
    if (reading === null) throw new Error("no reading");
    const check = checkSeed(reading, {
      presetId: "open",
      settings: getPreset("open").settings,
    });
    if (check.kind !== "differs") throw new Error(check.kind);
    expect(check.settings.dungeonItems).toBe("keys");
    expect(keyCellsShown(check.settings)).toBe(true);
    // Into DR's world: the small keys recorded as found, the big key kept
    // inside (maybe until held, as the pack's contract walks it)
    expect(drSettingsOf(check.settings)).toMatchObject({
      wildBigKeys: false,
      wildCompasses: false,
      wildKeys: true,
      wildMaps: false,
    });
    expect(keyHoldingOf(drSettingsOf(check.settings))).toBe("wild");
  });
});
