import { describe, expect, it } from "vitest";
import {
  bridgeUrl,
  fitObsGrid,
  isObsView,
  obsBackground,
  obsTimer,
  obsViewUrl,
  trackerUrl,
} from "@/utils/view";

describe("isObsView", () => {
  it("is on for view=obs, wherever it sits in the query", () => {
    expect(isObsView("?view=obs")).toBe(true);
    expect(isObsView("?bg=00ff00&view=obs")).toBe(true);
  });

  it("is off without it, or for any other view", () => {
    expect(isObsView("")).toBe(false);
    expect(isObsView("?bg=00ff00")).toBe(false);
    expect(isObsView("?view=map")).toBe(false);
    expect(isObsView("?view=OBS")).toBe(false);
    expect(isObsView("?view=obs2")).toBe(false);
  });

  it("reads the page's own query string by default", () => {
    window.history.replaceState(null, "", "/?view=obs");
    expect(isObsView()).toBe(true);
    window.history.replaceState(null, "", "/");
    expect(isObsView()).toBe(false);
  });
});

describe("obsBackground", () => {
  it("accepts 3, 4, 6 or 8 hex digits, with or without #", () => {
    expect(obsBackground("?view=obs&bg=0f0")).toBe("#0f0");
    expect(obsBackground("?view=obs&bg=0f08")).toBe("#0f08");
    expect(obsBackground("?view=obs&bg=00ff00")).toBe("#00ff00");
    expect(obsBackground("?view=obs&bg=000000b3")).toBe("#000000b3");
    // "#" is %23 in a query string
    expect(obsBackground("?view=obs&bg=%2300FF00")).toBe("#00ff00");
  });

  it("is null when absent or empty", () => {
    expect(obsBackground("?view=obs")).toBeNull();
    expect(obsBackground("?view=obs&bg=")).toBeNull();
  });

  it.each([
    ["a colour name", "green"],
    ["five digits", "00ff0"],
    ["seven digits", "00ff000"],
    ["a non-hex digit", "00gg00"],
    ["a trailing space", "00ff00%20"],
    ["a CSS function", "rgb(0,255,0)"],
    [
      "a declaration break-out",
      "00ff00;background-image:url(//evil.example/x)",
    ],
    ["a rule break-out", "0f0}body{display:none"],
    ["a script URL", "javascript:alert(1)"],
    ["markup", "%3Cscript%3Ealert(1)%3C/script%3E"],
    ["a doubled #", "%23%2300ff00"],
  ])("refuses %s", (_, value) => {
    expect(obsBackground(`?view=obs&bg=${value}`)).toBeNull();
  });

  it("reads the page's own query string by default", () => {
    window.history.replaceState(null, "", "/?view=obs&bg=123456");
    expect(obsBackground()).toBe("#123456");
    window.history.replaceState(null, "", "/");
  });
});

describe("bridgeUrl", () => {
  it("is SNI on this computer at the port named", () => {
    expect(bridgeUrl("?bridge=23075")).toBe("ws://localhost:23075");
    expect(bridgeUrl("?view=obs&bridge=1")).toBe("ws://localhost:1");
    expect(bridgeUrl("?bridge=65535")).toBe("ws://localhost:65535");
  });

  it("takes nothing but a port: no host, no scheme, nothing out of range", () => {
    for (const value of [
      "",
      "0",
      "65536",
      "123456",
      "-1",
      "23074.5",
      "evil.example:23074",
      "ws://evil.example:23074",
      "localhost:23074",
    ]) {
      expect(bridgeUrl(`?bridge=${encodeURIComponent(value)}`)).toBeUndefined();
    }
    expect(bridgeUrl("")).toBeUndefined();
  });

  it("reads the page's own query string by default", () => {
    window.history.replaceState(null, "", "/?bridge=8080");
    expect(bridgeUrl()).toBe("ws://localhost:8080");
    window.history.replaceState(null, "", "/");
    expect(bridgeUrl()).toBeUndefined();
  });
});

describe("trackerUrl and obsViewUrl", () => {
  it("point at the deployment's base, whatever page they are built from", () => {
    const page = "https://example.org/some/path?view=map#map";

    // Vitest serves the app from "/", GitHub Pages from "/alltp-tracker/"
    expect(trackerUrl(page)).toBe("https://example.org/");
    expect(obsViewUrl({}, page)).toBe("https://example.org/?view=obs");
  });

  it("build from the current page by default", () => {
    expect(obsViewUrl()).toBe(`${window.location.origin}/?view=obs`);
  });

  it("asks the stream view for the run timer, which obsTimer reads", () => {
    const url = obsViewUrl({ timer: true }, "https://example.org/");
    expect(url).toBe("https://example.org/?view=obs&timer=1");
    expect(obsTimer(new URL(url).search)).toBe(true);
    expect(obsTimer(new URL(obsViewUrl({}, url)).search)).toBe(false);
  });
});

describe("obsTimer", () => {
  it("draws the timer for timer=1 only", () => {
    expect(obsTimer("?view=obs&timer=1")).toBe(true);
    expect(obsTimer("?view=obs")).toBe(false);
    expect(obsTimer("?view=obs&timer=0")).toBe(false);
    expect(obsTimer("?view=obs&timer")).toBe(false);
  });

  it("reads the page's own query string by default", () => {
    window.history.replaceState(null, "", "/?view=obs&timer=1");
    expect(obsTimer()).toBe(true);
    window.history.replaceState(null, "", "/");
    expect(obsTimer()).toBe(false);
  });
});

describe("fitObsGrid", () => {
  /** The grid's size and margins for a fit, to check it is whole and centred. */
  const layout = (width: number, height: number, rows: number) => {
    const fit = fitObsGrid({ height, rows, width });
    return {
      ...fit,
      bottom: height - fit.top - rows * fit.cell,
      right: width - fit.left - 8 * fit.cell,
    };
  };

  it("snaps the cell to a multiple of 16 when that costs under an eighth", () => {
    // 1080 / 6 rows = 180 px of room: 176 keeps 98 % of it
    expect(fitObsGrid({ height: 1080, rows: 6, width: 1920 })).toEqual({
      cell: 176,
      left: 256,
      top: 12,
    });
    // 700 / 7 = 100: 96
    expect(fitObsGrid({ height: 700, rows: 7, width: 800 }).cell).toBe(96);
    // 400 / 8 = 50: 48
    expect(fitObsGrid({ height: 350, rows: 7, width: 400 }).cell).toBe(48);
  });

  it("falls back to an even size when the crisp one would shrink the grid too much", () => {
    // 260 / 7 = 37.1: 32 would give up 14 %, so 36
    expect(fitObsGrid({ height: 260, rows: 7, width: 300 }).cell).toBe(36);
    // A strip 200 px tall: 28.6 of room, 16 would halve it
    expect(fitObsGrid({ height: 200, rows: 7, width: 1920 }).cell).toBe(28);
  });

  it("matches the icons' own 64 px at the recommended source sizes", () => {
    expect(fitObsGrid({ height: 384, rows: 6, width: 512 })).toEqual({
      cell: 64,
      left: 0,
      top: 0,
    });
    expect(fitObsGrid({ height: 896, rows: 7, width: 1024 }).cell).toBe(128);
  });

  it.each([
    [300, 260],
    [400, 350],
    [800, 700],
    [1920, 1080],
    [1920, 200],
    [301, 263],
    [1366, 768],
  ])("keeps the grid whole, inside and centred at %i×%i", (width, height) => {
    for (const rows of [6, 7]) {
      const { bottom, cell, left, right, top } = layout(width, height, rows);

      expect(Number.isInteger(cell)).toBe(true);
      expect(cell % 2).toBe(0);
      expect(Number.isInteger(left) && Number.isInteger(top)).toBe(true);
      expect(Math.min(left, right, top, bottom)).toBeGreaterThanOrEqual(0);
      expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
      expect(Math.abs(top - bottom)).toBeLessThanOrEqual(1);
      // Never more than an eighth of the room given up
      const room = Math.min(width / 8, height / rows);
      expect(cell).toBeGreaterThanOrEqual(Math.floor(room * (7 / 8)));
    }
  });

  it("works in device pixels on a scaled screen", () => {
    // At 125 %, 1536×864 CSS px are 1920×1080 device px: 1080 / 6 = 180 → 176
    const fit = fitObsGrid({
      height: 864,
      pixelRatio: 1.25,
      rows: 6,
      width: 1536,
    });

    expect(fit.cell * 1.25).toBeCloseTo(176, 9);
    expect(fit.left * 1.25).toBeCloseTo(256, 9);
    expect(fit.top * 1.25).toBeCloseTo(12, 9);
  });

  it("keeps a usable cell in a viewport too small for the grid", () => {
    expect(fitObsGrid({ height: 0, rows: 7, width: 0 })).toEqual({
      cell: 2,
      left: 0,
      top: 0,
    });
  });
});
