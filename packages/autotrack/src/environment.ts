// Which OS, CPU and browser the tracker runs in, to pick the right bridge
// download and the right permission instructions. User-Agent Client Hints
// first (Chromium), the User-Agent string otherwise. Chromium freezes the
// platform part of its UA string (UA reduction) and every macOS browser
// reports "Intel Mac OS X" on Apple Silicon too, so the UA string only gives
// the CPU where it is not frozen: Firefox on Linux. Anything else stays
// "unknown", and says so.

export type OperatingSystem =
  | "windows"
  | "macos"
  | "linux"
  | "chromeos"
  | "android"
  | "ios"
  | "unknown";

export type CpuArchitecture = "x86_64" | "arm64" | "x86" | "arm" | "unknown";

/** Engines differ in how they gate loopback; that is what matters here. */
export type BrowserFamily = "chromium" | "firefox" | "safari" | "other";

/**
 * How the browser treats a WebSocket from an HTTPS page to localhost:
 * - "prompt": allowed after a local network permission prompt (Chromium
 *   147+, Firefox 154+);
 * - "open": allowed without a prompt (older Chromium and Firefox, or an
 *   http page);
 * - "blocked": refused as mixed content (Safari and every iOS browser:
 *   WebKit bug 171934 is open);
 * - "unknown": another engine.
 */
export type LoopbackAccess = "prompt" | "open" | "blocked" | "unknown";

export interface Environment {
  readonly os: OperatingSystem;
  readonly arch: CpuArchitecture;
  /** Where `arch` came from; "unknown" when it could not be told. */
  readonly archSource: "client-hints" | "user-agent" | "unknown";
  readonly browser: BrowserFamily;
  /** e.g. "Chrome", "Edge", "Firefox", "Safari"; null if unknown. */
  readonly browserName: string | null;
  readonly browserMajor: number | null;
  /**
   * The engine's major version (Chromium's for Edge or Opera, whose own
   * numbers differ), which decides `loopback`.
   */
  readonly engineMajor: number | null;
  readonly loopback: LoopbackAccess;
}

interface UserAgentData {
  readonly brands?: readonly {
    readonly brand: string;
    readonly version: string;
  }[];
  readonly platform?: string;
  getHighEntropyValues?(
    hints: readonly string[],
  ): Promise<{ readonly architecture?: string; readonly bitness?: string }>;
}

export interface NavigatorLike {
  readonly userAgent?: string;
  readonly userAgentData?: UserAgentData;
}

/** What the UA string alone says. Pure; exported for tests. */
export function parseUserAgent(userAgent: string): Environment {
  const ua = userAgent;
  const os: OperatingSystem = /iPhone|iPad|iPod/.test(ua)
    ? "ios"
    : /Windows NT/.test(ua)
      ? "windows"
      : /Android/.test(ua)
        ? "android"
        : /CrOS/.test(ua)
          ? "chromeos"
          : /Macintosh|Mac OS X/.test(ua)
            ? "macos"
            : /Linux/.test(ua)
              ? "linux"
              : "unknown";

  // Most specific first: Edge and Opera also say "Chrome/", Chrome says
  // "Safari/". Every iOS browser is WebKit, whatever its name.
  const browsers: readonly (readonly [RegExp, BrowserFamily, string])[] =
    os === "ios"
      ? [
          [/CriOS\/(\d+)/, "safari", "Chrome"],
          [/FxiOS\/(\d+)/, "safari", "Firefox"],
          [/EdgiOS\/(\d+)/, "safari", "Edge"],
          [/Version\/(\d+).*Safari\//, "safari", "Safari"],
        ]
      : [
          [/Firefox\/(\d+)/, "firefox", "Firefox"],
          [/Edg\/(\d+)/, "chromium", "Edge"],
          [/OPR\/(\d+)/, "chromium", "Opera"],
          [/Chromium\/(\d+)/, "chromium", "Chromium"],
          [/Chrome\/(\d+)/, "chromium", "Chrome"],
          [/Version\/(\d+).*Safari\//, "safari", "Safari"],
        ];
  let browser: BrowserFamily = "other";
  let browserName: string | null = null;
  let major: string | undefined;
  for (const [pattern, family, name] of browsers) {
    const found = pattern.exec(ua);
    if (found !== null) {
      browser = family;
      browserName = name;
      major = found[1];
      break;
    }
  }
  if (os === "ios" && browserName === null) {
    browser = "safari";
    browserName = "Safari";
  }

  let arch: CpuArchitecture = "unknown";
  if (browser === "firefox" && os === "linux") {
    arch = /x86_64|amd64/.test(ua)
      ? "x86_64"
      : /aarch64|arm64/.test(ua)
        ? "arm64"
        : /i[3-6]86/.test(ua)
          ? "x86"
          : /armv[67]/.test(ua)
            ? "arm"
            : "unknown";
  }
  const browserMajor = major === undefined ? null : Number(major);
  const chrome = /Chrome\/(\d+)/.exec(ua)?.[1];
  const engineMajor =
    browser === "chromium" && chrome !== undefined
      ? Number(chrome)
      : browserMajor;
  return {
    arch,
    archSource: arch === "unknown" ? "unknown" : "user-agent",
    browser,
    browserMajor,
    browserName,
    engineMajor,
    loopback: loopbackAccess(browser, engineMajor, true),
    os,
  };
}

/**
 * Loopback WebSocket gating by engine and major version. Chromium prompts
 * for WebSockets since 147 (Chrome 147 release notes); Firefox since 154
 * (Firefox 154 release notes); WebKit blocks ws://localhost from HTTPS as
 * mixed content (bugs.webkit.org 171934). An http page is never gated.
 */
export function loopbackAccess(
  browser: BrowserFamily,
  major: number | null,
  pageIsHttps: boolean,
): LoopbackAccess {
  if (!pageIsHttps) return browser === "other" ? "unknown" : "open";
  switch (browser) {
    case "chromium":
      return major !== null && major < 147 ? "open" : "prompt";
    case "firefox":
      return major !== null && major < 154 ? "open" : "prompt";
    case "safari":
      return "blocked";
    case "other":
      return "unknown";
  }
}

const PLATFORMS: Record<string, OperatingSystem> = {
  Android: "android",
  "Chrome OS": "chromeos",
  "Chromium OS": "chromeos",
  iOS: "ios",
  Linux: "linux",
  macOS: "macos",
  Windows: "windows",
};

const BRAND_NAMES: Record<string, string> = {
  Brave: "Brave",
  "Google Chrome": "Chrome",
  "Microsoft Edge": "Edge",
  Opera: "Opera",
};

function architectureOf(
  architecture?: string,
  bitness?: string,
): CpuArchitecture {
  if (architecture === "x86") return bitness === "32" ? "x86" : "x86_64";
  if (architecture === "arm") return bitness === "32" ? "arm" : "arm64";
  return "unknown";
}

/**
 * The environment of `navigator` (globalThis.navigator by default), with the
 * page's protocol deciding whether loopback is gated at all: only an https
 * page is. The desktop app's pages, `tauri://localhost` on macOS and Linux
 * and `http://tauri.localhost` on Windows, are not mixed content's concern,
 * though their WebKit reads as Safari.
 */
export async function detectEnvironment(
  navigator: NavigatorLike | undefined = (
    globalThis as { navigator?: NavigatorLike }
  ).navigator,
  pageIsHttps = (globalThis as { location?: { protocol?: string } }).location
    ?.protocol === "https:",
): Promise<Environment> {
  const parsed = parseUserAgent(navigator?.userAgent ?? "");
  const data = navigator?.userAgentData;
  let env: Environment = parsed;
  if (data !== undefined) {
    const brand = data.brands?.find((b) => BRAND_NAMES[b.brand] !== undefined);
    const chromium = data.brands?.find((b) => b.brand === "Chromium");
    const version = brand?.version ?? chromium?.version;
    env = {
      ...parsed,
      browser:
        chromium !== undefined || brand !== undefined
          ? "chromium"
          : parsed.browser,
      browserMajor:
        version !== undefined
          ? Number.parseInt(version, 10)
          : parsed.browserMajor,
      browserName:
        brand !== undefined
          ? BRAND_NAMES[brand.brand]
          : chromium !== undefined
            ? "Chromium"
            : parsed.browserName,
      engineMajor:
        chromium !== undefined
          ? Number.parseInt(chromium.version, 10)
          : parsed.engineMajor,
      os:
        (data.platform !== undefined && PLATFORMS[data.platform]) || parsed.os,
    };
    try {
      const hints = await data.getHighEntropyValues?.([
        "architecture",
        "bitness",
      ]);
      const arch = architectureOf(hints?.architecture, hints?.bitness);
      if (arch !== "unknown")
        env = { ...env, arch, archSource: "client-hints" };
    } catch {
      // Hints refused (a permissions policy): keep what the UA string said.
    }
  }
  return {
    ...env,
    loopback: loopbackAccess(env.browser, env.engineMajor, pageIsHttps),
  };
}
