import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  forgetDoorSeeds,
  loadDoorSeed,
} from "@/games/alttpr/autotrack/doorSeed";

const AVIANART = { hash: "C2BdrZOiV", site: "avianart" } as const;
const HTH = {
  site: "hth",
  url: "https://hyruletownhall.com/seed/DR_x.bps",
} as const;

const answer = (response: () => Promise<Response>) => {
  const fetch = vi.fn(response);
  vi.stubGlobal("fetch", fetch);
  return fetch;
};

beforeEach(() => forgetDoorSeeds());
afterEach(() => vi.unstubAllGlobals());

describe("loadDoorSeed", () => {
  it("says the site is offline, and asks again next time", async () => {
    const fetch = answer(() => Promise.reject(new TypeError("offline")));
    expect(await loadDoorSeed(AVIANART)).toBe("offline");
    expect(await loadDoorSeed(AVIANART)).toBe("offline");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("tells a seed not there from a site that fails", async () => {
    answer(() => Promise.resolve(new Response("", { status: 404 })));
    expect(await loadDoorSeed(AVIANART)).toBe("not-found");
    forgetDoorSeeds();
    answer(() => Promise.resolve(new Response("", { status: 503 })));
    expect(await loadDoorSeed(AVIANART)).toBe("offline");
  });

  it("asks a seed it read once only", async () => {
    const fetch = answer(() =>
      Promise.resolve(new Response("", { status: 404 })),
    );
    await loadDoorSeed(HTH);
    await loadDoorSeed(HTH);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("refuses what is no seed the tracker reads", async () => {
    // Not JSON from avianart, not a patch from Hyrule Town Hall
    answer(() => Promise.resolve(new Response("<html>")));
    expect(await loadDoorSeed(AVIANART)).toBe("unrecognized");
    expect(await loadDoorSeed(HTH)).toBe("unrecognized");
    // A patch heavier than any ROM's, never read
    forgetDoorSeeds();
    const heavy = new Uint8Array(8 * 1024 * 1024 + 1);
    answer(() => Promise.resolve(new Response(heavy)));
    expect(await loadDoorSeed(HTH)).toBe("unrecognized");
  });
});
