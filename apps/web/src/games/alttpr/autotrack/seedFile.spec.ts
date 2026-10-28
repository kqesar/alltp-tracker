import {
  type SeedSettingsReading,
  seedFileReading,
  seedFileUrl,
} from "@alltp/pack-alttpr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  forgetSeedFiles,
  loadSeedFile,
  withSeedFile,
} from "@/games/alttpr/autotrack/seedFile";
import daily from "../../../../../../packs/alttpr/test/seed-files/eM43RgZ4Gj.json";

/** fetch, answering each call with the next of `answers`. */
const stubFetch = (...answers: (() => Promise<Response>)[]) => {
  const fetch = vi.fn(() => {
    const answer = answers.shift();
    if (answer === undefined) throw new Error("No answer left");
    return answer();
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
};

const json = (body: unknown) => async () => new Response(JSON.stringify(body));
const status = (code: number) => async () =>
  new Response("<Error/>", { status: code });
const unreachable = async (): Promise<Response> => {
  throw new TypeError("Failed to fetch");
};

beforeEach(() => forgetSeedFiles());
afterEach(() => vi.unstubAllGlobals());

describe("loadSeedFile", () => {
  it("reads a seed's settings from its file on alttpr.com, asked once", async () => {
    const fetch = stubFetch(json(daily));

    const file = await loadSeedFile("eM43RgZ4Gj");
    expect(file).toEqual(seedFileReading(daily));
    expect(await loadSeedFile("eM43RgZ4Gj")).toBe(file);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(seedFileUrl("eM43RgZ4Gj"));
  });

  it("says when alttpr.com has no such seed", async () => {
    stubFetch(status(403), status(404));

    expect(await loadSeedFile("eM43RgZ4Gj")).toBe("not-found");
    expect(await loadSeedFile("9MQ9gO1wMD")).toBe("not-found");
  });

  it("asks again after alttpr.com could not be reached", async () => {
    const fetch = stubFetch(unreachable, status(503), json(daily));

    expect(await loadSeedFile("eM43RgZ4Gj")).toBe("offline");
    expect(await loadSeedFile("eM43RgZ4Gj")).toBe("offline");
    expect(await loadSeedFile("eM43RgZ4Gj")).toMatchObject({
      seed: "eM43RgZ4Gj",
    });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("says alttpr.com could not be reached when the parser could not load either", async () => {
    stubFetch(json(daily));
    vi.doMock("@/games/alttpr/autotrack/seedFileReading", () => {
      throw new TypeError("Failed to fetch dynamically imported module");
    });
    try {
      expect(await loadSeedFile("eM43RgZ4Gj")).toBe("offline");
    } finally {
      vi.doUnmock("@/games/alttpr/autotrack/seedFileReading");
    }
  });

  it("refuses a file that is not vt's, or another seed's", async () => {
    stubFetch(
      async () => new Response("not json"),
      json({ hash: "eM43RgZ4Gj" }),
      json(daily),
    );

    expect(await loadSeedFile("aaaaaaaaaa")).toBe("unrecognized");
    expect(await loadSeedFile("bbbbbbbbbb")).toBe("unrecognized");
    expect(await loadSeedFile("cccccccccc")).toBe("unrecognized");
  });
});

describe("withSeedFile", () => {
  const RACE_MODE = { known: false, why: "race-mode" } as const;
  /** What a race seed's ROM says: its name and logic, nothing else. */
  const raceRom: SeedSettingsReading = {
    crystalsGanon: RACE_MODE,
    crystalsTower: RACE_MODE,
    goal: RACE_MODE,
    logic: { known: true, value: "NoGlitches" },
    mode: RACE_MODE,
    seed: "eM43RgZ4Gj",
    swordless: RACE_MODE,
    wildBigKeys: RACE_MODE,
    wildCompasses: RACE_MODE,
    wildKeys: RACE_MODE,
    wildMaps: RACE_MODE,
  };
  const file = seedFileReading(daily) as SeedSettingsReading;

  it("takes from the file every setting the ROM does not state, and only those", () => {
    const rom = {
      ...raceRom,
      // A setting the ROM states stands, whatever the file says
      goal: { known: true, value: "ganon" },
      mode: { known: false, why: "not-read" },
      swordless: { known: false, why: "unrecognized" },
    } as const;

    expect(withSeedFile(rom, file)).toEqual({ ...file, goal: rom.goal });
    // The settings only the file states come with it
    expect(withSeedFile(rom, file)).toMatchObject({
      itemFunctionality: { known: true, value: "hard" },
      itemPlacement: { known: true, value: "basic" },
      itemPool: { known: true, value: "hard" },
    });
  });

  it("takes the file's logic, which the ROM's seed type folds", () => {
    // Major Glitches, Hybrid Major Glitches and No Logic write one seed type
    const rom = {
      ...raceRom,
      logic: { known: true, value: "MajorGlitches" },
    } as const;
    const hybrid = {
      ...file,
      logic: { known: true, value: "HybridMajorGlitches" },
    } as const;

    expect(withSeedFile(rom, hybrid).logic).toEqual(hybrid.logic);
    // A file that names none leaves the ROM's
    expect(
      withSeedFile(rom, {
        ...file,
        logic: { known: false, why: "unrecognized" },
      }).logic,
    ).toEqual(rom.logic);
  });

  it("keeps the ROM's when the file is another seed's", () => {
    expect(withSeedFile(raceRom, { ...file, seed: "9MQ9gO1wMD" })).toBe(
      raceRom,
    );
  });
});
