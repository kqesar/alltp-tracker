import { describe, expect, it } from "vitest";
import { getPreset, type RunSettings } from "@/games/alttpr/data/presets";
import {
  bossOfValue,
  knownBossIndex,
  knownBossShown,
  knownBossText,
  knownBossValues,
  stepKnownBoss,
  valueOfBoss,
} from "@/games/alttpr/logic/knownBosses";
import { packReading } from "@/games/alttpr/logic/packItems";

const open = getPreset("open").settings;
const shuffled: RunSettings = { ...open, bossShuffle: "full" };
const swordless: RunSettings = { ...shuffled, swordless: true };

/** The grid's Tower of Hera, Skull Woods, Ice Palace and Misery Mire. */
const HERA = 2;
const SKULL = 5;
const ICE = 7;
const MIRE = 8;

describe("a dungeon's known boss", () => {
  it("names the pack's bosses from 1, not known at 0", () => {
    expect(bossOfValue(0)).toBeUndefined();
    expect(bossOfValue(1)).toBe("armosKnights");
    expect(bossOfValue(10)).toBe("trinexx");
    expect(valueOfBoss("blind")).toBe(7);
    expect(knownBossText(7)).toBe("Blind the Thief");
    expect(knownBossText(0)).toBe("unknown");
    expect(knownBossIndex("knownboss8")).toBe(MIRE);
    expect(knownBossIndex("boss8")).toBeNull();
  });

  it("offers only the bosses its slot can hold", () => {
    // Tower of Hera: Moldorm, Helmasaur King, Mothula, Kholdstare, Vitreous
    expect(knownBossValues(HERA, shuffled)).toEqual([0, 3, 4, 6, 8, 9]);
    expect(knownBossValues(SKULL, shuffled)).not.toContain(10);
    expect(knownBossValues(MIRE, shuffled)).toHaveLength(11);
    // Swordless keeps Kholdstare in Ice Palace
    expect(knownBossValues(MIRE, swordless)).not.toContain(8);
    expect(
      knownBossValues(MIRE, { ...swordless, hidden: ["swordless"] }),
    ).toContain(8);
  });

  it("steps round them both ways", () => {
    expect(stepKnownBoss(HERA, 0, shuffled, 1)).toBe(3);
    expect(stepKnownBoss(HERA, 9, shuffled, 1)).toBe(0);
    expect(stepKnownBoss(HERA, 0, shuffled, -1)).toBe(9);
    // A value the slot cannot take steps from not known
    expect(stepKnownBoss(HERA, 10, shuffled, 1)).toBe(3);
  });

  it("is the player's while the run's bosses may move, but swordless Ice Palace's", () => {
    expect(knownBossShown(MIRE, open)).toBe(false);
    expect(knownBossShown(MIRE, shuffled)).toBe(true);
    expect(knownBossShown(MIRE, { ...open, hidden: ["bossShuffle"] })).toBe(
      true,
    );
    expect(knownBossShown(ICE, swordless)).toBe(false);
    expect(knownBossShown(MIRE, swordless)).toBe(true);
  });

  it("reaches the pack as the slot's boss", () => {
    expect(packReading({ knownboss8: 7 } as never).bosses).toEqual({
      miseryMire: "blind",
    });
    expect(packReading({ knownboss8: 0 } as never)).not.toHaveProperty(
      "bosses",
    );
  });
});
