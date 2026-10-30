import { BONK_DROPS } from "@alltp/pack-alttpr/bonk";
import { describe, expect, it } from "vitest";
import { readingOf, SAVE, seedMemory } from "@/games/alttpr/autotrack/fixtures";
import { setBonkDrops } from "@/games/alttpr/data/doorRando";

describe("readMemory", () => {
  it("decodes the bonk drops once loaded, each by its screen's bit", () => {
    const memory = seedMemory({ race: false });
    // The pyramid's tree: screen $5B, bit $10 (owr:MultiClient.py:978-987)
    memory[SAVE(0x280 + 0x5b)] = 0x10;
    // Not loaded: no bonk drop is decoded
    expect(readingOf(memory).checked).not.toContain("pyramid-tree");
    setBonkDrops(BONK_DROPS);
    const reading = readingOf(memory);
    expect(reading.checked).toContain("pyramid-tree");
    expect(reading.doorRead).toContain("lost-woods-hideout-tree");
    // The cave's statue: no screen's byte flags it, so it is never read
    expect(reading.doorRead).not.toContain("cold-fairy-statue");
    // Its range not read (a run that keeps them in place): none
    const unread = readingOf(memory, { unread: ["owr-bonks"] });
    expect(unread.checked).not.toContain("pyramid-tree");
    expect(unread.doorRead).not.toContain("pyramid-tree");
    // Race Mode: withheld, never checked
    const race = readingOf(memory, { race: true });
    expect(race.checked).not.toContain("pyramid-tree");
    expect(race.unsettled).toContainEqual(["pyramid-tree", "race-mode"]);
  });
});
