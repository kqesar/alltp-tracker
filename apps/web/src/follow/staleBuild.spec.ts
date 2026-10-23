import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isStaleBuild } from "@/follow/staleBuild";

const page = (src: string) =>
  `<!doctype html><html><head><script type="module" crossorigin src="${src}"></script><link rel="stylesheet" href="/assets/index-x.css"></head><body><div id="root"></div></body></html>`;

/** A `fetch` that answers the page's own address with this HTML. */
const serving = (html: string, init: ResponseInit = {}) =>
  vi.fn(async () => new Response(html, init)) as unknown as typeof fetch;

describe("isStaleBuild", () => {
  beforeEach(() => {
    // The entry script this page runs (innerHTML runs no script)
    document.head.innerHTML =
      '<script type="module" crossorigin src="/assets/index-old1.js"></script>';
  });
  afterEach(() => {
    document.head.innerHTML = "";
  });

  it("is stale when the app serves another entry script than this page runs", async () => {
    const fetchPage = serving(page("/assets/index-new2.js"));

    expect(await isStaleBuild(fetchPage)).toBe(true);
    // Asked for fresh, at the page's own address
    expect(fetchPage).toHaveBeenCalledWith("/", { cache: "no-store" });
  });

  it("is not stale when it serves the same build", async () => {
    expect(await isStaleBuild(serving(page("/assets/index-old1.js")))).toBe(
      false,
    );
  });

  it.each([
    ["a server error", serving("oops", { status: 500 })],
    ["a page with no entry script", serving("<html><body></body></html>")],
    [
      "a request that fails",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }) as unknown as typeof fetch,
    ],
  ])("is not stale when it cannot tell: %s", async (_name, fetchPage) => {
    expect(await isStaleBuild(fetchPage)).toBe(false);
  });

  it("is not stale when this page has no entry script to compare", async () => {
    document.head.innerHTML = "";

    expect(await isStaleBuild(serving(page("/assets/index-new2.js")))).toBe(
      false,
    );
  });
});
