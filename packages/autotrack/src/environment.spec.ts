import { describe, expect, it, vi } from "vitest";
import {
  detectEnvironment,
  loopbackAccess,
  type NavigatorLike,
  parseUserAgent,
} from "./environment";

describe("parseUserAgent", () => {
  it.each([
    [
      "Chrome on Windows (UA reduction freezes the CPU token)",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      {
        arch: "unknown",
        browser: "chromium",
        browserMajor: 155,
        browserName: "Chrome",
        loopback: "prompt",
        os: "windows",
      },
    ],
    [
      "Edge on Windows",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.3856.62",
      {
        browser: "chromium",
        browserMajor: 146,
        browserName: "Edge",
        loopback: "open",
        os: "windows",
      },
    ],
    [
      "Opera, whose own version is not Chromium's",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 OPR/128.0.0.0",
      {
        browserMajor: 128,
        browserName: "Opera",
        engineMajor: 150,
        loopback: "prompt",
      },
    ],
    [
      "Firefox on Linux x86_64 (CachyOS)",
      "Mozilla/5.0 (X11; Linux x86_64; rv:158.0) Gecko/20100101 Firefox/158.0",
      {
        arch: "x86_64",
        archSource: "user-agent",
        browser: "firefox",
        browserMajor: 158,
        loopback: "prompt",
        os: "linux",
      },
    ],
    [
      "Firefox ESR 153 on Linux ARM (no WebSocket gate before 154)",
      "Mozilla/5.0 (X11; Linux aarch64; rv:153.0) Gecko/20100101 Firefox/153.0",
      { arch: "arm64", browser: "firefox", loopback: "open", os: "linux" },
    ],
    [
      "Firefox on macOS (always says Intel)",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:158.0) Gecko/20100101 Firefox/158.0",
      {
        arch: "unknown",
        archSource: "unknown",
        browser: "firefox",
        os: "macos",
      },
    ],
    [
      "Safari on macOS",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
      {
        browser: "safari",
        browserMajor: 26,
        browserName: "Safari",
        loopback: "blocked",
        os: "macos",
      },
    ],
    [
      "Chrome on iOS, which is WebKit",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/155.0.7568.70 Mobile/15E148 Safari/604.1",
      {
        browser: "safari",
        browserName: "Chrome",
        loopback: "blocked",
        os: "ios",
      },
    ],
    [
      "Chrome on Android",
      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36",
      { browser: "chromium", os: "android" },
    ],
    [
      "Chrome on ChromeOS",
      "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
      { arch: "unknown", browser: "chromium", os: "chromeos" },
    ],
    [
      "an empty string",
      "",
      {
        arch: "unknown",
        browser: "other",
        browserName: null,
        loopback: "unknown",
        os: "unknown",
      },
    ],
  ])("%s", (_, ua, expected) => {
    expect(parseUserAgent(ua)).toMatchObject(expected);
  });
});

describe("loopbackAccess", () => {
  it("is open on an http page and gated by engine version on https", () => {
    expect(loopbackAccess("chromium", 155, false)).toBe("open");
    expect(loopbackAccess("safari", 26, false)).toBe("open");
    expect(loopbackAccess("chromium", 147, true)).toBe("prompt");
    expect(loopbackAccess("chromium", 146, true)).toBe("open");
    expect(loopbackAccess("chromium", null, true)).toBe("prompt");
    expect(loopbackAccess("firefox", 154, true)).toBe("prompt");
    expect(loopbackAccess("other", 1, true)).toBe("unknown");
  });
});

describe("detectEnvironment", () => {
  const chromeLinux =
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36";
  const brands = [
    { brand: "Not.A/Brand", version: "99" },
    { brand: "Chromium", version: "155" },
    { brand: "Google Chrome", version: "155" },
  ];

  it("takes the CPU from client hints", async () => {
    const navigator: NavigatorLike = {
      userAgent: chromeLinux,
      userAgentData: {
        brands,
        getHighEntropyValues: () =>
          Promise.resolve({ architecture: "arm", bitness: "64" }),
        platform: "macOS",
      },
    };
    expect(await detectEnvironment(navigator, true)).toMatchObject({
      arch: "arm64",
      archSource: "client-hints",
      browser: "chromium",
      browserName: "Chrome",
      engineMajor: 155,
      loopback: "prompt",
      os: "macos",
    });
  });

  it("names Edge from its brand, and keeps the UA's answer when hints fail", async () => {
    const navigator: NavigatorLike = {
      userAgent: chromeLinux,
      userAgentData: {
        brands: [
          ...brands.slice(0, 2),
          { brand: "Microsoft Edge", version: "155" },
        ],
        getHighEntropyValues: () => Promise.reject(new Error("denied")),
        platform: "Windows",
      },
    };
    expect(await detectEnvironment(navigator, true)).toMatchObject({
      arch: "unknown",
      archSource: "unknown",
      browserName: "Edge",
      os: "windows",
    });
  });

  it("reads 32-bit x86 hints, and the page protocol", async () => {
    const navigator: NavigatorLike = {
      userAgent: chromeLinux,
      userAgentData: {
        brands,
        getHighEntropyValues: () =>
          Promise.resolve({ architecture: "x86", bitness: "32" }),
      },
    };
    expect(await detectEnvironment(navigator, false)).toMatchObject({
      arch: "x86",
      loopback: "open",
      os: "linux",
    });
  });

  it("gates loopback on https pages only: the desktop app's WebKit is open", async () => {
    const safari: NavigatorLike = {
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
    };
    const at = async (protocol: string) => {
      vi.stubGlobal("location", { protocol });
      const { loopback } = await detectEnvironment(safari);
      vi.unstubAllGlobals();
      return loopback;
    };
    expect(await at("https:")).toBe("blocked");
    expect(await at("tauri:")).toBe("open");
    expect(await at("http:")).toBe("open");
  });

  it("works without a navigator", async () => {
    expect(await detectEnvironment(undefined, true)).toMatchObject({
      browser: "other",
      os: "unknown",
    });
    expect((await detectEnvironment()).os).toBeDefined();
  });
});
