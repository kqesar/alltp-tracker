import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decodeRun, sharedPayload } from "@/share/runLink";
import {
  CHAT_LINK_CHARS,
  copyFullLink,
  copyLink,
  makeLink,
  shareRun,
} from "@/share/shareRun";

/** A run as an export writes it, `size` locations checked. */
const save = (size: number) =>
  JSON.stringify({
    format: "alltp-tracker-save",
    game: "smz3",
    progress: {
      // Distinct, unpredictable text: it compresses little, as a real run's ids
      checked: Array.from(
        { length: size },
        (_, index) => `zone-${index}/${(index * 7919).toString(36)}`,
      ),
    },
    version: 1,
  });

describe("sharing a run", () => {
  const writeText = vi.fn<(text: string) => Promise<void>>();

  beforeEach(() => {
    writeText.mockReset().mockResolvedValue();
    vi.stubGlobal("navigator", { clipboard: { writeText } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("copies a link that opens the run it came from", async () => {
    const { link, message: line } = await shareRun([save(3)]);

    const url = new URL(writeText.mock.calls[0][0]);
    expect(url.hash.startsWith("#run=")).toBe(true);
    expect(JSON.parse(await decodeRun(sharedPayload(url.hash) ?? ""))).toEqual(
      JSON.parse(save(3)),
    );
    // The link made is the one copied
    expect(link?.url).toBe(url.href);
    // The line says where the run is, and that no server gets it
    expect(line).toBe(
      "Link copied. The run stays in the link, never sent to a server.",
    );
  });

  it("falls back to the shorter form when the first is too long for a chat", async () => {
    const long = save(400);
    const short = save(3);

    const link = await makeLink([long, short]);
    const { message: line } = await shareRun([long, short]);

    expect(link.url.length).toBeLessThanOrEqual(CHAT_LINK_CHARS);
    expect(line).toBe("Link copied without the timeline, to keep it short.");
    // The first form is kept, for the player who wants it whole
    expect(link.full?.length).toBeGreaterThan(CHAT_LINK_CHARS);
    const full = new URL(link.full ?? "");
    expect(JSON.parse(await decodeRun(sharedPayload(full.hash) ?? ""))).toEqual(
      JSON.parse(long),
    );
  });

  it("keeps the first form when it fits", async () => {
    const link = await makeLink([save(3), save(1)]);

    expect(link.full).toBeNull();
  });

  it("copies the full form of a shortened link, and says how long it is", async () => {
    const { link } = await shareRun([save(400), save(3)]);
    const full = link?.full ?? "";
    writeText.mockClear();

    expect(await copyFullLink(full)).toBe(
      `Full link copied, with the timeline (${full.length} characters): some chat apps will cut it.`,
    );
    expect(writeText).toHaveBeenCalledWith(full);

    writeText.mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    expect(await copyFullLink(full)).toMatch(/refused the clipboard/);
  });

  it("copies a link that is still too long, and says so", async () => {
    const { message: line } = await shareRun([save(400)]);

    expect(writeText).toHaveBeenCalledOnce();
    expect(line).toMatch(
      /^Link copied, but long \(\d+ characters\): some chat apps will cut it\.$/,
    );
  });

  it("says so when even the shorter form is long", async () => {
    const { message: line } = await shareRun([save(900), save(400)]);

    expect(line).toMatch(/^Link copied without the timeline, but still long/);
  });

  it("says why when the clipboard refuses, and still returns the link", async () => {
    writeText.mockRejectedValue(new DOMException("denied", "NotAllowedError"));

    const { link, message } = await shareRun([save(3)]);

    expect(message).toBe(
      "The link could not be copied: this browser refused the clipboard.",
    );
    expect(link?.url).toMatch(/#run=/);
  });

  it("says why when the browser cannot compress, with no link", async () => {
    vi.stubGlobal("CompressionStream", undefined);

    expect(await shareRun([save(3)])).toEqual({
      link: null,
      message: "This browser cannot turn a run into a link.",
    });
    expect(writeText).not.toHaveBeenCalled();
  });

  it("copies a link again, and says so or why not", async () => {
    const { link } = await shareRun([save(3)]);
    writeText.mockClear();

    expect(await copyLink(link as NonNullable<typeof link>)).toMatch(
      /^Link copied\./,
    );
    expect(writeText).toHaveBeenCalledWith(link?.url);

    writeText.mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    expect(await copyLink(link as NonNullable<typeof link>)).toMatch(
      /refused the clipboard/,
    );
  });
});
