import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KEPT } from "../../scripts/record-dr-seeds.mjs";
import { MEMORY_RANGE } from "../autotrack/memory";
import { SEED_SETTINGS_RANGES } from "../autotrack/seed-settings";
import {
  avianartReading,
  avianartUrl,
  bpsReading,
  bpsTarget,
  doorSeedLinkOf,
} from "./seed-import";

// Recorded by scripts/record-dr-seeds.mjs from avianart.games and Hyrule
// Town Hall, cut to what the tracker reads: never edited by hand
const FIXTURES = join(import.meta.dirname, "../../test/dr-seeds");
const avianart = (hash: string) =>
  JSON.parse(
    readFileSync(join(FIXTURES, `avianart-${hash}.json`), "utf8"),
  ) as unknown;
const HTH = "DR_78388fdd-435c-4961-8fae-0500424d5bf5.bps";
const hth = () => new Uint8Array(readFileSync(join(FIXTURES, `hth-${HTH}`)));

/** A setting's value, or its reason as `?reason`. */
const shown = (setting: { known: boolean; value?: unknown; why?: string }) =>
  setting.known ? setting.value : `?${setting.why}`;

describe("doorSeedLinkOf", () => {
  it("names an avianart permalink and a Hyrule Town Hall patch", () => {
    expect(doorSeedLinkOf("https://avianart.games/perm/C2BdrZOiV")).toEqual({
      hash: "C2BdrZOiV",
      site: "avianart",
    });
    expect(doorSeedLinkOf(" avianart.games/perm/u6BKiwo1E/ ")).toEqual({
      hash: "u6BKiwo1E",
      site: "avianart",
    });
    expect(doorSeedLinkOf(`https://hyruletownhall.com/seed/${HTH}`)).toEqual({
      site: "hth",
      url: `https://hyruletownhall.com/seed/${HTH}`,
    });
    for (const other of [
      "https://alttpr.com/h/eM43RgZ4Gj",
      "https://avianart.games/perm/",
      "https://evil.example/avianart.games/perm/C2BdrZOiV",
      "https://hyruletownhall.com/seed/VT_78388fdd-435c-4961-8fae-0500424d5bf5.bps",
    ]) {
      expect(doorSeedLinkOf(other), other).toBeNull();
    }
    expect(avianartUrl("C2BdrZOiV")).toBe(
      "https://avianart.games/api.php?action=permlink&hash=C2BdrZOiV",
    );
  });
});

describe("avianartReading", () => {
  it("reads Crosskeys keydrop's settings from a race seed's meta", () => {
    const reading = avianartReading(avianart("C2BdrZOiV"), "C2BdrZOiV");
    expect(reading).not.toBeNull();
    if (reading === null) return;
    expect({
      goal: shown(reading.goal),
      logic: shown(reading.logic),
      mode: shown(reading.mode),
      seed: reading.seed,
      wildKeys: shown(reading.wildKeys),
    }).toEqual({
      goal: "dungeons",
      logic: "NoGlitches",
      mode: "standard",
      seed: "C2BdrZOiV",
      wildKeys: true,
    });
    expect(reading.randomizer).toEqual({
      kind: "door",
      overworld: false,
      version: "1.5.6",
    });
    expect(reading.doorExact).toEqual({
      bombBag: false,
      doorShuffle: "vanilla",
      dropShuffle: "keys",
      enemyShuffle: "none",
      keyLogic: "partial",
      openPyramid: "auto",
      potShuffle: false,
      pottery: "keys",
      restrictBossItems: "none",
      shopsanity: false,
      takeAny: "none",
    });
    expect(shown(reading.door?.pottery ?? { known: false })).toBe(
      "beyond-caves",
    );
  });

  it("names the Overworld fork, its settings and DR's own entrance shuffle", () => {
    const reading = avianartReading(avianart("u6BKiwo1E"), "u6BKiwo1E");
    expect(reading?.randomizer).toMatchObject({ overworld: true });
    expect(reading?.doorExact).toMatchObject({
      doorEntrances: "swapped",
      overworld: {
        bonkDrops: false,
        crossed: "none",
        fluteShuffle: "vanilla",
        followers: false,
        layout: "vanilla",
        mixed: false,
        prizeShuffle: "none",
        whirlpool: false,
      },
    });
    // Swapped entrances keep the pyramid shut under `auto`
    // (BaseClasses.py:300-311): the crystals goal is Ganon's
    expect(reading && shown(reading.goal)).toBe("ganon");
    expect(reading && shown(reading.entrances ?? { known: false })).toBe(
      "?unrecognized",
    );
  });

  it("reads OWR 0.8.0.2's prize shuffle and followers, which its rules read", () => {
    const json = avianart("4kxBlrWuP") as {
      response: { spoiler: { meta: Record<string, unknown> } };
    };
    const reading = avianartReading(json, "4kxBlrWuP");
    expect(reading?.door?.version).toMatchObject({ value: "1.5.7" });
    expect(reading?.doorExact?.overworld).toMatchObject({
      followers: false,
      prizeShuffle: "none",
    });
    // A seed that moves them (the same meta, as the fork writes it)
    const { meta } = json.response.spoiler;
    const moved = avianartReading(
      {
        response: {
          spoiler: {
            meta: { ...meta, prizeshuffle: "wild", shuffle_followers: true },
          },
        },
      },
      "4kxBlrWuP",
    );
    expect(moved?.doorExact?.overworld).toMatchObject({
      followers: true,
      prizeShuffle: "wild",
    });
    // Not named: not known, never none
    const unnamed = { ...meta };
    delete unnamed.prizeshuffle;
    delete unnamed.shuffle_followers;
    const without = avianartReading(
      { response: { spoiler: { meta: unnamed } } },
      "4kxBlrWuP",
    )?.doorExact?.overworld;
    expect(without).not.toHaveProperty("followers");
    expect(without).not.toHaveProperty("prizeShuffle");
  });

  it("reads OWR's custom goals: none while each is None", () => {
    const json = avianart("4kxBlrWuP") as {
      response: { spoiler: { meta: Record<string, unknown> } };
    };
    const { meta } = json.response.spoiler;
    const goals = (custom_goals: unknown) =>
      avianartReading(
        { response: { spoiler: { meta: { ...meta, custom_goals } } } },
        "4kxBlrWuP",
      )?.doorExact?.overworld?.customGoals;
    // The recorded meta: gtentry, ganongoal, pedgoal, murahgoal all None
    expect(
      avianartReading(json, "4kxBlrWuP")?.doorExact?.overworld,
    ).toMatchObject({ customGoals: false });
    // A customizer's GT entry (Rules.py:536-538), and a multiworld's map
    const gt = { requirements: [{ condition: 0x02, target: 5 }] };
    expect(goals({ ...(meta.custom_goals as object), gtentry: gt })).toBe(true);
    expect(goals({ 1: { gtentry: null, pedgoal: null } })).toBe(false);
    expect(goals({ 1: { gtentry: gt, pedgoal: null } })).toBe(true);
    // Not named (DR itself, an older fork): not known
    expect(goals(undefined)).toBeUndefined();
  });

  it("reads every enemy, lottery pots and shopsanity, crossed entrances", () => {
    const reading = avianartReading(avianart("uv7P2Luey"), "uv7P2Luey");
    expect(reading?.doorExact).toMatchObject({
      dropShuffle: "underworld",
      pottery: "lottery",
      shopsanity: true,
    });
    expect(reading && shown(reading.entrances ?? { known: false })).toBe(
      "crossed",
    );
    // Older seeds write a boolean where newer ones write "wild"
    expect(reading && shown(reading.wildMaps)).toBe(true);
    expect(reading && shown(reading.goal)).toBe("triforce-hunt");
  });

  it("reads the bomb bag, pot shuffle, restricted boss items and pyramid DR's rules read", () => {
    const json = avianart("C2BdrZOiV") as {
      response: { spoiler: { meta: Record<string, unknown> } };
    };
    const meta = json.response.spoiler.meta;
    const read = (change: Record<string, unknown>) =>
      avianartReading(
        { response: { spoiler: { meta: { ...meta, ...change } } } },
        "x",
      )?.doorExact;
    expect(
      read({
        bombbag: true,
        open_pyramid: "no",
        potshuffle: 1,
        restricted_boss_items: "mapcompass",
        shuffle: "crossed",
        shufflelinks: true,
        shuffletavern: false,
      }),
    ).toMatchObject({
      bombBag: true,
      openPyramid: "no",
      potShuffle: true,
      restrictBossItems: "mapcompass",
      shuffleLinks: true,
      shuffleTavern: false,
    });
    // An older seed's flag; a meta without them names none
    expect(read({ open_pyramid: true })?.openPyramid).toBe("yes");
    const without = read({
      bombbag: undefined,
      open_pyramid: undefined,
      potshuffle: undefined,
      restricted_boss_items: undefined,
      shufflelinks: undefined,
      shuffletavern: undefined,
    });
    expect(without).not.toHaveProperty("shuffleLinks");
    expect(without).not.toHaveProperty("shuffleTavern");
    // With vanilla entrances they move nothing: not named (the race seed's
    // meta says its tavern is shuffled)
    expect(read({ shufflelinks: true })).not.toHaveProperty("shuffleLinks");
    // A door shuffle's intensity and coupling, named only with doors shuffled
    expect(
      read({ decoupledoors: 1, door_shuffle: "crossed", intensity: 3 }),
    ).toMatchObject({ decoupledDoors: true, doorIntensity: 3 });
    expect(read({ door_shuffle: "basic", intensity: "2" })).toMatchObject({
      doorIntensity: 2,
    });
    expect(read({ intensity: 3 })).not.toHaveProperty("doorIntensity");
    expect(
      read({ door_shuffle: "basic", intensity: "random" }),
    ).not.toHaveProperty("doorIntensity");
    expect(without).not.toHaveProperty("bombBag");
    expect(without).not.toHaveProperty("openPyramid");
    expect(without).not.toHaveProperty("potShuffle");
    expect(without).not.toHaveProperty("restrictBossItems");
  });

  it("refuses JSON without a DR meta", () => {
    expect(avianartReading({ response: {} }, "x")).toBeNull();
    expect(avianartReading("nothing", "x")).toBeNull();
    expect(
      avianartReading(
        { response: { spoiler: { meta: { version: "31" } } } },
        "x",
      ),
    ).toBeNull();
  });
});

describe("bpsTarget", () => {
  /** BPS1, source 4, target 8, no metadata, the commands, 12 checksum bytes. */
  const patch = (...commands: number[]) =>
    Uint8Array.of(
      ...[..."BPS1"].map((c) => c.charCodeAt(0)),
      0x84,
      0x88,
      0x80,
      ...commands,
      ...new Array(12).fill(0),
    );

  it("knows what TargetRead and TargetCopy write, never what the source gives", () => {
    // TargetRead "AB", TargetCopy 2 from offset 0, SourceRead 2, SourceCopy 2
    const { bytes, known } = bpsTarget(
      patch(0x85, 0x41, 0x42, 0x87, 0x80, 0x84, 0x86, 0x80),
    );
    expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe("ABAB");
    expect([...known]).toEqual([1, 1, 1, 1, 0, 0, 0, 0]);
  });

  it("refuses bytes that are no patch, or write past their target", () => {
    expect(() => bpsTarget(Uint8Array.of(1, 2, 3))).toThrow("Not a BPS patch");
    // SourceRead of 9 into a target of 8
    expect(() => bpsTarget(patch(0xa0))).toThrow("past its target");
  });
});

describe("bpsReading", () => {
  it("reads a Hyrule Town Hall patch's settings as the ROM decoder does", () => {
    const reading = bpsReading(hth());
    expect(reading?.seed).toBe("1_1_367825107");
    expect(reading?.randomizer).toEqual({
      kind: "door",
      overworld: false,
      version: "1.5.6",
    });
    // The study's decoding of this patch: DRMode 0, DRFlags $0213 (mirror
    // scroll, no enemy drops), pottery off
    expect(reading?.door && shown(reading.door.doorShuffle)).toBe("vanilla");
    expect(reading?.door && shown(reading.door.version)).toBe("1.5.6");
    expect(reading?.door && shown(reading.door.pottery)).toBe("none");
    // The item substitutions' bomb upgrade entry: +10, no bag
    // (Rom.py:1063)
    expect(reading?.door && shown(reading.door.bombBag)).toBe(false);
  });

  it("keeps only the bytes the settings decoder reads, none of a location", () => {
    const { known } = bpsTarget(hth());
    const kept = new Set<number>();
    for (const [offset, size] of KEPT) {
      for (let i = 0; i < size; i++) kept.add(offset + i);
    }
    for (let at = 0; at < known.length; at++) {
      if (known[at] === 1 && !kept.has(at)) {
        throw new Error(`0x${at.toString(16)} is in the fixture`);
      }
    }
    // Each kept range is one the decoder reads, never a prize's
    const ranges = [
      MEMORY_RANGE["rom-header"],
      ...SEED_SETTINGS_RANGES.filter((range) => range.category === "other"),
    ];
    for (const [offset, size] of KEPT) {
      expect(
        ranges.some(
          (range) =>
            range.address <= offset &&
            offset + size <= range.address + range.size,
        ),
        offset.toString(16),
      ).toBe(true);
    }
  });

  it("refuses bytes that are no patch, and a patch of no DR seed", () => {
    expect(bpsReading(Uint8Array.of(1, 2, 3))).toBeNull();
    const patch = hth();
    const { bytes } = bpsTarget(patch);
    expect(String.fromCharCode(...bytes.subarray(0x7fc0, 0x7fc2))).toBe("DR");
    // The same patch titled as an alttpr.com seed is none of DR's
    const title = [..."DR156_"].map((c) => c.charCodeAt(0));
    const at = patch.findIndex((_, i) =>
      title.every((byte, k) => patch[i + k] === byte),
    );
    expect(at).toBeGreaterThan(0);
    patch.set(
      [..."VT 156"].map((c) => c.charCodeAt(0)),
      at,
    );
    expect(bpsReading(patch)).toBeNull();
  });
});
