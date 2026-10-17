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
} from "@/autotrack/seedFile";
import daily from "../../../../packs/alttpr/test/seed-files/eM43RgZ4Gj.json";

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
    vi.doMock("@/autotrack/seedFileReading", () => {
      throw new TypeError("Failed to fetch dynamically imported module");
    });
    try {
      expect(await loadSeedFile("eM43RgZ4Gj")).toBe("offline");
    } finally {
      vi.doUnmock("@/autotrack/seedFileReading");
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

  it("takes from the file what Race Mode kept from the tracker, and only that", () => {
    const rom = {
      ...raceRom,
      logic: { known: false, why: "not-read" },
    } as const;

    expect(withSeedFile(rom, file)).toEqual({ ...file, logic: rom.logic });
  });

  it("keeps the ROM's when the file is another seed's", () => {
    expect(withSeedFile(raceRom, { ...file, seed: "9MQ9gO1wMD" })).toBe(
      raceRom,
    );
  });
});
