import { describe, expect, it } from "vitest";
import { readSmz3 } from "@/games/smz3/autotrack/reading";
import {
  SAMPLE_GUID,
  viewOf,
  writeSmz3,
} from "../../../../../../packs/smz3/test/smz3-rom";

const memory = () => writeSmz3(new Uint8Array(0x100_0000), {});

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
