import { MAP_LOCATIONS } from "@alltp/pack-alttpr";
import { SM_ITEMS } from "@alltp/pack-sm";
import { ITEMS } from "@alltp/pack-smz3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import {
  parseSave as parseAlttpr,
  withoutTimeline,
} from "@/games/alttpr/stores/persistence";
import { exportSave as exportSm, useSmStore } from "@/games/sm/store";
import {
  exportSave as exportSmz3,
  LOCATION_IDS,
  useSmz3Store,
} from "@/games/smz3/store";
import {
  clearSharedRun,
  decodeRun,
  encodeRun,
  gameOfSave,
  MAX_PAYLOAD_CHARS,
  MAX_RUN_BYTES,
  RunLinkError,
  runLinkUrl,
  sharedPayload,
} from "@/share/runLink";
import { CHAT_LINK_CHARS } from "@/share/shareRun";

/** The base64url alphabet, which needs no escaping in a fragment. */
const BASE64URL = /^[A-Za-z0-9_-]+$/;

/** Deflate text, then base64url it: what a hostile link would hold. */
const deflated = async (bytes: Uint8Array<ArrayBuffer>) => {
  const stream = new CompressionStream("deflate-raw");
  const writer = stream.writable.getWriter();
  void writer.write(bytes).then(() => writer.close());
  const out = await new Response(stream.readable).arrayBuffer();
  return btoa(String.fromCharCode(...new Uint8Array(out)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

/** A reproducible stream of numbers in [0, 1): runs differ by their seed only. */
const randoms = () => {
  let seed = 7;
  return () => {
    seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return seed / 4_294_967_296;
  };
};

/**
 * Play a game's store as a player does, a click or a check every 20 to 100
 * seconds: `share` of what there is to find gets found. The clock moves, so
 * the ALttPR timeline's stamps are as unpredictable as a real run's.
 */
const play = {
  alttpr: (share: number, random: () => number) => {
    useGameStore.setState(useGameStore.getInitialState(), true);
    const store = useGameStore.getState();
    store.startTimer(Date.now());
    const tick = () =>
      vi.setSystemTime(Date.now() + 20_000 + Math.floor(random() * 80_000));
    const items = Object.keys(store.items).filter(
      (id) => !id.startsWith("chest") && !id.startsWith("boss"),
    );
    for (const id of items) {
      for (let click = 0; click < 4; click++) {
        if (random() >= share) continue;
        tick();
        store.handleItemClick(id);
      }
    }
    for (const id of MAP_LOCATIONS) {
      if (random() >= share) continue;
      tick();
      store.toggleChecks([id]);
    }
    return useGameStore.getState().exportState();
  },
  sm: (share: number, random: () => number) => {
    useSmStore.setState(useSmStore.getInitialState(), true);
    for (const item of SM_ITEMS) {
      for (let n = 0; n < item.max; n++) {
        if (random() < share) useSmStore.getState().step(item.id, 1);
      }
    }
    return exportSm(useSmStore.getState());
  },
  smz3: (share: number, random: () => number) => {
    useSmz3Store.setState(useSmz3Store.getInitialState(), true);
    for (const item of ITEMS) {
      for (let n = 0; n < item.max; n++) {
        if (random() < share) useSmz3Store.getState().step(item.id, 1);
      }
    }
    for (const id of LOCATION_IDS) {
      if (random() < share) useSmz3Store.getState().toggleChecks([id]);
    }
    return exportSmz3(useSmz3Store.getState());
  },
};

const STAGES = { early: 0.15, late: 0.95, mid: 0.5 } as const;

describe("a run in a link", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(1_760_000_000_000);
  });
  afterEach(() => vi.useRealTimers());

  describe.each(Object.keys(play) as (keyof typeof play)[])("%s", (game) => {
    it.each(Object.entries(STAGES))(
      "comes back as it left, early, mid and late (%s)",
      async (_stage, share) => {
        const save = play[game](share, randoms());
        const payload = await encodeRun(save);

        expect(payload).toMatch(BASE64URL);
        // Minified on the way in: the same save, the same data
        expect(JSON.parse(await decodeRun(payload))).toEqual(JSON.parse(save));
        expect(gameOfSave(await decodeRun(payload))).toBe(game);
      },
    );
  });

  // The lengths of the whole link on the site, measured on runs played as
  // above (the numbers in docs/share.md): what a chat app has to take
  it("keeps a link within a browser's limits, and a chat's where it can", async () => {
    const lengths: Record<string, number> = {};
    for (const [stage, share] of Object.entries(STAGES)) {
      const save = play.alttpr(share, randoms());
      for (const [form, text] of [
        ["full", save],
        ["slim", withoutTimeline(save)],
      ] as const) {
        const url = runLinkUrl(
          "https://kqesar.github.io/alltp-tracker/",
          await encodeRun(text),
        );
        lengths[`alttpr ${stage} ${form}`] = url.length;
      }
      for (const game of ["sm", "smz3"] as const) {
        const url = runLinkUrl(
          "https://kqesar.github.io/alltp-tracker/",
          await encodeRun(play[game](share, randoms())),
        );
        lengths[`${game} ${stage}`] = url.length;
      }
    }

    // Everything fits what browsers take (Chrome 2 MB, Firefox 1 MB, Safari 80 KB)
    for (const length of Object.values(lengths)) {
      expect(length).toBeLessThan(25_000);
    }
    // Super Metroid's runs are tiny; ALttPR's without its timeline and SMZ3's
    // fit a chat message early in the run, and grow past it after
    expect(lengths["sm late"]).toBeLessThan(CHAT_LINK_CHARS);
    expect(lengths["alttpr early slim"]).toBeLessThan(CHAT_LINK_CHARS);
    expect(lengths["smz3 early"]).toBeLessThan(CHAT_LINK_CHARS);
    // The timeline is most of an ALttPR run, which is why it is what goes
    expect(lengths["alttpr late full"]).toBeGreaterThan(
      lengths["alttpr late slim"] * 2,
    );
  });

  it("drops the timeline but keeps the run, which still imports", async () => {
    const save = play.alttpr(0.5, randoms());
    const slim = withoutTimeline(save);

    const full = parseAlttpr(save);
    const dated = parseAlttpr(slim);
    expect(full.ok && dated.ok).toBe(true);
    if (!(full.ok && dated.ok)) return;
    expect(Object.keys(full.progress.timeline ?? {}).length).toBeGreaterThan(0);
    expect(dated.progress.timeline).toEqual({});
    expect(dated.progress.items).toEqual(full.progress.items);
    expect(dated.progress.checked).toEqual(full.progress.checked);
  });
});

describe("a link that is not a run", () => {
  it("refuses text that is not base64url", async () => {
    for (const payload of ["", "not base64!", "a+b/c=", "éé"]) {
      await expect(decodeRun(payload)).rejects.toMatchObject({
        failure: "malformed",
      });
    }
  });

  it("refuses bytes that are not deflate", async () => {
    await expect(decodeRun("AAAAAAAAAAAAAAAA")).rejects.toBeInstanceOf(
      RunLinkError,
    );
    await expect(decodeRun("a")).rejects.toMatchObject({
      failure: "malformed",
    });
  });

  it("refuses deflated bytes that are not text", async () => {
    const payload = await deflated(new Uint8Array([0xff, 0xfe, 0xfd]));

    await expect(decodeRun(payload)).rejects.toMatchObject({
      failure: "malformed",
    });
  });

  it("refuses a payload longer than a run can be, unread", async () => {
    await expect(
      decodeRun("A".repeat(MAX_PAYLOAD_CHARS + 1)),
    ).rejects.toMatchObject({ failure: "too-large" });
  });

  it("stops a deflate bomb at the limit instead of inflating it", async () => {
    // A few hundred bytes of deflate that inflate to ten times the limit
    const bomb = await deflated(
      new TextEncoder().encode("0".repeat(MAX_RUN_BYTES * 10)),
    );
    expect(bomb.length).toBeLessThan(MAX_PAYLOAD_CHARS);

    await expect(decodeRun(bomb)).rejects.toMatchObject({
      failure: "too-large",
    });
  });

  it("reads a game from the envelope alone, or none", () => {
    const envelope = (game: unknown, format = "alltp-tracker-save") =>
      JSON.stringify({ format, game, progress: {}, version: 1 });

    expect(gameOfSave(envelope("sm"))).toBe("sm");
    expect(gameOfSave(envelope("zelda1"))).toBeNull();
    expect(gameOfSave(envelope(undefined))).toBeNull();
    expect(gameOfSave(envelope("sm", "something-else"))).toBeNull();
    expect(gameOfSave("[1, 2]")).toBeNull();
    expect(gameOfSave("not json")).toBeNull();
  });
});

describe("the address", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("puts the payload in the fragment, where no server reads it", () => {
    const url = new URL(runLinkUrl("https://example.org/tracker/?x=1", "abc"));

    expect(url.hash).toBe("#run=abc");
    expect(url.pathname).toBe("/tracker/");
  });

  it("reads a payload back, and nothing from any other fragment", () => {
    expect(sharedPayload("#run=abc_-9")).toBe("abc_-9");
    expect(sharedPayload("#main-content")).toBeNull();
    expect(sharedPayload("")).toBeNull();
  });

  it("clears the fragment, keeping the page and its query", () => {
    window.history.replaceState(null, "", "/tracker/?view=obs#run=abc");

    clearSharedRun();

    expect(window.location.hash).toBe("");
    expect(window.location.pathname + window.location.search).toBe(
      "/tracker/?view=obs",
    );
  });
});
