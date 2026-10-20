import { describe, expect, it } from "vitest";
import { packLink, unpackLink } from "@/games/smz3/share";
import { LOCATION_IDS, parseSave } from "@/games/smz3/store";
import { toBase64Url } from "@/share/bytes";
import legacyLink from "@/share/fixtures/link-smz3-before-sizes.json";
import { LINK_FORMAT, OTHER_VERSION } from "@/share/packed";
import { play, randoms, STAGES } from "@/share/playedRuns";

/** The run a save holds, read as an import reads it. */
const runOf = (save: string) => {
  const parsed = parseSave(save);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.progress;
};

describe("an SMZ3 run in a packed link", () => {
  it.each(Object.entries(STAGES))(
    "comes back as it left (%s)",
    (_stage, share) => {
      const save = play.smz3(share, randoms());

      const link = packLink(save);
      const unpacked = unpackLink(link);

      expect(JSON.parse(link).format).toBe(LINK_FORMAT);
      expect(unpacked.ok).toBe(true);
      if (!unpacked.ok) return;
      const expected = runOf(save);
      const got = runOf(unpacked.save);
      expect([...got.checked].sort()).toEqual([...expected.checked].sort());
      expect(got).toEqual({ ...expected, checked: got.checked });
      expect(expected.checked.length).toBeGreaterThan(0);
    },
  );

  // Made as links were written before they carried the table's size
  // (fixtures/): three locations checked, the first, the 101st and the last
  it("opens a link made before the links carried sizes", () => {
    const unpacked = unpackLink(JSON.stringify(legacyLink));

    expect(unpacked.ok).toBe(true);
    if (!unpacked.ok) return;
    expect([...runOf(unpacked.save).checked].sort()).toEqual(
      [LOCATION_IDS[0], LOCATION_IDS[100], LOCATION_IDS[315]].sort(),
    );
  });

  it("holds the locations as bits: a late run's list is a few dozen bytes", () => {
    const save = play.smz3(0.95, randoms());

    expect(JSON.parse(packLink(save)).progress.checked).toHaveLength(
      Math.ceil((Math.ceil(LOCATION_IDS.length / 8) * 4) / 3),
    );
  });

  it("opens a plain link as it always did", () => {
    const save = play.smz3(0.5, randoms());

    expect(unpackLink(save)).toEqual({ ok: true, save });
  });

  it("leaves a save it cannot pack as it is", () => {
    const file = JSON.parse(play.smz3(0.5, randoms()));
    for (const checked of [
      ["no/such-place"],
      [LOCATION_IDS[0], LOCATION_IDS[0]],
    ]) {
      const odd = JSON.stringify({
        ...file,
        progress: { ...file.progress, checked },
      });
      expect(packLink(odd)).toBe(odd);
    }
  });

  it("refuses a link made against another list of locations", () => {
    const link = JSON.parse(packLink(play.smz3(0.5, randoms())));
    link.table = "AAAAAA";

    expect(unpackLink(JSON.stringify(link))).toEqual({
      ok: false,
      reason: OTHER_VERSION,
    });
  });

  it("refuses a bitset of the wrong length", () => {
    const link = JSON.parse(packLink(play.smz3(0.5, randoms())));

    for (const length of [0, 5, Math.ceil(LOCATION_IDS.length / 8) + 1]) {
      link.progress.checked = toBase64Url(new Uint8Array(length));
      expect(unpackLink(JSON.stringify(link))).toEqual({
        ok: false,
        reason: "This link does not hold a tracker run.",
      });
    }
  });
});
