import { MEMORY_RANGE } from "@alltp/pack-smz3";
import { describe, expect, it } from "vitest";
import { readSmz3 } from "@/games/smz3/autotrack/reading";
import {
  SAMPLE_GUID,
  viewOf,
  writeSmz3,
} from "../../../../../../packs/smz3/test/smz3-rom";

const memory = () => writeSmz3(new Uint8Array(0x100_0000), {});

describe("the crystals", () => {
  // Crystals 5 and 6, the red ones (bits $04 and $01), and a blue one ($02)
  const withCrystals = () => {
    const image = memory();
    image[MEMORY_RANGE["zelda-wram"].address + 0x37a] = 0x07;
    return viewOf(image, "zelda");
  };

  it("are told apart outside Race Mode", () => {
    expect(readSmz3(withCrystals(), false, 0).items).toMatchObject({
      crystalBlue: 1,
      crystalRed: 2,
    });
  });

  it("are never told in Race Mode, so no 5/6 crystal is named", () => {
    const { items } = readSmz3(withCrystals(), true, 0);
    if (typeof items === "string") throw new Error(items);
    expect(items).not.toHaveProperty("crystalRed");
    expect(items).not.toHaveProperty("crystalBlue");
    // The pendants still count once found
    expect(items).toHaveProperty("pendantGreen");
  });
});

describe("the seed's guid", () => {
  it("is read outside Race Mode", () => {
    expect(readSmz3(viewOf(memory(), "zelda"), false, 0).guid).toEqual({
      guid: SAMPLE_GUID,
    });
  });

  it("is never decoded in Race Mode, whatever the memory holds", () => {
    // The session leaves the range unread in a race; decoding says so even
    // if a snapshot held it
    expect(readSmz3(viewOf(memory(), "zelda"), true, 0).guid).toBe("race-mode");
    expect(
      readSmz3(viewOf(memory(), "zelda", ["seed-guid"]), true, 0).guid,
    ).toBe("race-mode");
  });
});
