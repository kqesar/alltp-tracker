import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { packLink as packAlttpr } from "@/games/alttpr/share";
import {
  parseSave as parseAlttpr,
  withoutTimeline,
} from "@/games/alttpr/stores/persistence";
import { packLink as packSmz3 } from "@/games/smz3/share";
import { play, randoms, STAGES } from "@/share/playedRuns";
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
  it("keeps a link within a chat message's limit through a whole run", async () => {
    const lengths: Record<string, number> = {};
    const link = async (save: string) =>
      runLinkUrl(
        "https://kqesar.github.io/alltp-tracker/",
        await encodeRun(save),
      ).length;
    for (const [stage, share] of Object.entries(STAGES)) {
      const alttpr = play.alttpr(share, randoms());
      const smz3 = play.smz3(share, randoms());
      lengths[`alttpr ${stage} full`] = await link(packAlttpr(alttpr));
      lengths[`alttpr ${stage} slim`] = await link(
        packAlttpr(withoutTimeline(alttpr)),
      );
      lengths[`smz3 ${stage}`] = await link(packSmz3(smz3));
      lengths[`sm ${stage}`] = await link(play.sm(share, randoms()));
      // What packing saves: the plain forms the first version wrote
      expect(lengths[`alttpr ${stage} full`]).toBeLessThan(
        (await link(alttpr)) * 0.6,
      );
      expect(lengths[`smz3 ${stage}`]).toBeLessThan((await link(smz3)) * 0.7);
    }

    // Every run, at every stage, with its timeline, fits a chat message
    for (const [name, length] of Object.entries(lengths)) {
      expect(length, name).toBeLessThan(CHAT_LINK_CHARS);
    }
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
    // A packed link names its game in the same place
    expect(gameOfSave(envelope("smz3", "alltp-tracker-link"))).toBe("smz3");
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
