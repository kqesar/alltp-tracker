import { CHECK_FLAGS } from "@alltp/pack-alttpr";
import { describe, expect, it } from "vitest";
import { loadRegions } from "../../test/fixtures";
import { ZELDA_ALIASES } from "../markers";
import { REGION_MODULES } from "../regions";
import { locationId } from "../world";
import { SM_ITEM_BITS, ZELDA_FLAGS } from "./flags";
import { ZELDA_SAVE_SIZE } from "./memory";

const locationsOf = (game: string) =>
  REGION_MODULES.filter((m) => m.file.includes(`/${game}/`)).flatMap((m) =>
    m.region.locations.map((l) => l.id),
  );

describe("the location flags", () => {
  it("give every Zelda location the ALttPR pack's flag, in its save (-u writes them)", async () => {
    const byId = new Map(CHECK_FLAGS.map((entry) => [entry.id, entry.flag]));
    const flags = locationsOf("Zelda").map((id) => {
      const flag = byId.get(ZELDA_ALIASES[id] ?? id);
      if (flag === undefined) throw new Error(`No flag for ${id}`);
      // A count's threshold (ALttPR's Zelda and Agahnim) no SMZ3 location has
      if (!("mask" in flag)) throw new Error(`${id}: not a bit mask`);
      return {
        id,
        mask: flag.mask,
        offset: flag.at - 0x7e_f000,
        size: flag.size,
      };
    });
    await expect(`${JSON.stringify(flags, null, 1)}\n`).toMatchFileSnapshot(
      "./zelda-flags.json",
    );
    expect(ZELDA_FLAGS).toEqual(flags);
    for (const { offset, size } of flags) {
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset + size).toBeLessThanOrEqual(ZELDA_SAVE_SIZE);
    }
  });

  it("give every Super Metroid location upstream's id as its item's bit", () => {
    const ids = loadRegions()
      .filter((r) => r.file.includes("/SuperMetroid/"))
      .flatMap((r) => r.locations.map((l) => [locationId(l.name), l.id]));
    expect([...SM_ITEM_BITS].sort()).toEqual(ids.sort());
    expect([...SM_ITEM_BITS.keys()].sort()).toEqual(
      locationsOf("SuperMetroid").sort(),
    );
    // Every bit fits the 32 bytes of items collected
    for (const bit of SM_ITEM_BITS.values()) expect(bit).toBeLessThan(0x100);
  });
});
