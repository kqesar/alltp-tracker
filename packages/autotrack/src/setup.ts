// The "Set up autotracking" guide as data: ordered steps, each with the
// session states that mark it done or failing, and content variants per OS,
// CPU, browser and device. `setupProgress()` derives each step's state from
// the live session status, so the UI can tick steps and open the first
// failing one. Every claim names its source; the README's setup section and
// the draft guide are written from this file.

import type { SessionStatus } from "./diagnostics";
import type {
  BrowserFamily,
  CpuArchitecture,
  Environment,
  OperatingSystem,
} from "./environment";
import type { DeviceKind } from "./transport";

export type SetupStepId =
  | "get-bridge"
  | "run-bridge"
  | "emulator"
  | "permission"
  | "game";

/** When a variant applies; an absent field matches anything. */
export interface SetupCondition {
  readonly os?: readonly OperatingSystem[];
  readonly arch?: readonly CpuArchitecture[];
  readonly browser?: readonly BrowserFamily[];
  readonly device?: readonly DeviceKind[];
}

export interface SetupLink {
  readonly label: string;
  readonly url: string;
}

export interface SetupVariant {
  readonly when: SetupCondition;
  // Text may say "{game}": setupProgress() puts the pack's game name there.
  /** Short heading for the variant, e.g. "RetroArch". */
  readonly title: string;
  /** Instructions, one per item, in English, in order. */
  readonly items: readonly string[];
  readonly links: readonly SetupLink[];
  readonly sources: readonly string[];
  /** Claims the sources do not settle. */
  readonly unverified?: readonly string[];
}

/**
 * Status keys a step reacts to: a session code, or "memory-unreadable:" and
 * a cause for the memory failures that belong to different steps.
 */
export type StatusKey = string;

export interface SetupStep {
  readonly id: SetupStepId;
  readonly title: string;
  readonly done: readonly StatusKey[];
  readonly failing: readonly StatusKey[];
  readonly variants: readonly SetupVariant[];
}

export const SNI_RELEASES = "https://github.com/alttpo/sni/releases/latest";
export const SNI_LATEST_KNOWN = "0.0.103";

/**
 * SNI release asset names, from the v0.0.103 release
 * (github.com/alttpo/sni/releases/tag/v0.0.103); `{version}` is the tag
 * without its "v". macOS ships one universal binary (lipo, release.yml).
 */
export const SNI_ASSETS: readonly {
  readonly os: OperatingSystem;
  readonly arch: CpuArchitecture | "any";
  readonly name: string;
  readonly note?: string;
}[] = [
  { arch: "x86_64", name: "sni-v{version}-windows-amd64.zip", os: "windows" },
  { arch: "arm64", name: "sni-v{version}-windows-arm64.zip", os: "windows" },
  { arch: "x86", name: "sni-v{version}-windows-386.zip", os: "windows" },
  { arch: "arm", name: "sni-v{version}-windows-arm.zip", os: "windows" },
  { arch: "any", name: "sni-v{version}-darwin-universal.tar.gz", os: "macos" },
  {
    arch: "x86_64",
    name: "sni-v{version}-linux-amd64.tar.xz",
    note: "tray icon",
    os: "linux",
  },
  {
    arch: "x86_64",
    name: "sni-v{version}-linux-amd64-notray.tar.xz",
    note: "no tray icon, for desktops without one",
    os: "linux",
  },
  {
    arch: "arm64",
    name: "sni-v{version}-linux-arm64.tar.xz",
    note: "tray icon",
    os: "linux",
  },
  {
    arch: "arm64",
    name: "sni-v{version}-linux-arm64-notray.tar.xz",
    note: "no tray icon",
    os: "linux",
  },
];

/** The SNI downloads for an environment; every one of the OS's if the CPU is unknown. */
export function sniAssets(
  env: Pick<Environment, "os" | "arch">,
  version = SNI_LATEST_KNOWN,
) {
  const forOs = SNI_ASSETS.filter((asset) => asset.os === env.os);
  const exact = forOs.filter(
    (asset) => asset.arch === "any" || asset.arch === env.arch,
  );
  return (exact.length > 0 ? exact : forOs).map((asset) => ({
    ...asset,
    name: asset.name.replace("{version}", version),
  }));
}

const SNI_README =
  "https://github.com/alttpo/sni/blob/77ba8ac44ec63fc1c5f41549b6da9851085790a2/README.md";
const SNI_RELEASE_103 = "https://github.com/alttpo/sni/releases/tag/v0.0.103";
const RA_LABELS =
  "https://github.com/libretro/RetroArch/blob/v1.22.2/intl/msg_hash_us.h";
const RA_NETWORK_DOC =
  "https://docs.libretro.com/development/retroarch/network-control-interface/";
const RA_CFG_DOC = "https://docs.libretro.com/guides/cli-intro/";
const BUILDBOT = "https://buildbot.libretro.com/nightly/";
const CHROME_147 = "https://developer.chrome.com/release-notes/147";
const CHROME_145 = "https://developer.chrome.com/release-notes/145";
const FIREFOX_LNA =
  "https://support.mozilla.org/en-US/kb/control-personal-device-local-network-permissions-firefox";
const FIREFOX_154 = "https://www.firefox.com/en-US/firefox/154.0/releasenotes/";
const WEBKIT_171934 = "https://bugs.webkit.org/show_bug.cgi?id=171934";

const UNREADABLE_EMULATOR = [
  "memory-unreadable:no-memory-map",
  "memory-unreadable:address-unmapped",
  "memory-unreadable:zero-filled",
  "memory-unreadable:rom-unreadable",
  "memory-unreadable:read-failed",
];
const BRIDGE_REACHED = [
  "no-device",
  "attaching",
  "attach-failed",
  "memory-unreadable",
  "game-mismatch",
  "connected",
];

export const SETUP_STEPS: readonly SetupStep[] = [
  {
    done: BRIDGE_REACHED,
    failing: [],
    id: "get-bridge",
    title: "Get SNI",
    variants: [
      {
        items: [
          "Download the SNI file for your system from the latest release (the tracker names it).",
          "Unpack it in a folder of its own. It needs no installer.",
          "QUsb2Snes works too, but run only one of them: both listen on port 23074.",
        ],
        links: [{ label: "SNI releases", url: SNI_RELEASES }],
        sources: [SNI_RELEASE_103, SNI_README],
        title: "SNI",
        when: {},
      },
      {
        items: [
          'SNI is not notarized. If macOS refuses to open it, go to System Settings, Privacy & Security, and click "Open Anyway".',
        ],
        links: [
          {
            label: "Apple: open an app from an unknown developer",
            url: "https://support.apple.com/en-us/102445",
          },
        ],
        sources: ["https://support.apple.com/en-us/102445", SNI_RELEASE_103],
        title: "macOS",
        when: { os: ["macos"] },
      },
    ],
  },
  {
    done: BRIDGE_REACHED,
    failing: ["bridge-unreachable", "bridge-refused"],
    id: "run-bridge",
    title: "Run SNI",
    variants: [
      {
        items: [
          "Start sni.exe and leave it running. Its icon appears in the notification area.",
          "Its log is in %LOCALAPPDATA%\\sni.",
        ],
        links: [],
        sources: [SNI_README],
        title: "Windows",
        when: { os: ["windows"] },
      },
      {
        items: [
          "Open the unpacked folder and start ./sni from a terminal, or double-click it. Leave it running; its icon appears in the menu bar.",
          "Its log is in ~/.config/sni/ (or ~/.sni/ if that folder already exists).",
        ],
        links: [],
        sources: [SNI_README],
        title: "macOS",
        when: { os: ["macos"] },
      },
      {
        items: [
          "In a terminal, unpack it (tar -xf sni-v<version>-linux-amd64.tar.xz), then start it from that folder and leave it running: ./sni",
          "Without a tray on your desktop, use the -notray build; it runs the same, without an icon.",
          "Its log is in ~/.config/sni/ (or ~/.sni/ if that folder already exists).",
        ],
        links: [],
        sources: [
          SNI_README,
          "https://github.com/alttpo/sni/blob/77ba8ac44ec63fc1c5f41549b6da9851085790a2/cmd/sni/tray/tray_notray.go",
        ],
        title: "Linux",
        unverified: [
          "How the tray build behaves on GNOME without an AppIndicator extension.",
        ],
        when: { os: ["linux"] },
      },
      {
        items: [
          'Using QUsb2Snes instead? It asks, in its own window, whether to trust this site ("Untrusted origin"). Click Yes, then Retry here.',
        ],
        links: [],
        sources: [
          "https://github.com/Skarsnik/QUsb2snes/blob/184545cb6ed174b6cc4e7e646ddf0ee23407ebd1/core/wsserver.cpp",
        ],
        title: "QUsb2Snes",
        when: {},
      },
    ],
  },
  {
    done: ["game-mismatch", "connected", "memory-unreadable:no-content"],
    failing: ["no-device", "attach-failed", ...UNREADABLE_EMULATOR],
    id: "emulator",
    title: "Set up the emulator",
    variants: [
      {
        items: [
          'Install the bsnes-mercury core: Main Menu, Online Updater, Core Downloader, "Nintendo - SNES / SFC (bsnes-mercury Performance)". Snes9x, bsnes and bsnes-hd give RetroArch no memory map, so the tracker cannot read them.',
          "Keep it for {game} only: Main Menu, Import Content, Manual Scan. Set Content Directory to your {game} ROMs folder, System Name to Custom, Custom System Name to {game}, Default Core to bsnes-mercury Performance, then Start Scan. Start {game} from that playlist; other games keep their core.",
          "Turn on Settings, Network, Network Commands (Network Command Port stays 55355). If Network is missing, turn on Settings, User Interface, Show Advanced Settings first.",
          'Or edit retroarch.cfg while RetroArch is closed: network_cmd_enable = "true" and network_cmd_port = "55355".',
        ],
        links: [{ label: "RetroArch network commands", url: RA_NETWORK_DOC }],
        sources: [
          RA_LABELS,
          RA_NETWORK_DOC,
          SNI_README,
          "https://github.com/libretro/bsnes-mercury/blob/79d7f9de218b6ffa65a80bbdc5828532bc239232/target-libretro/libretro.cpp#L1174",
        ],
        title: "RetroArch",
        when: { device: ["retroarch", "unknown"] },
      },
      {
        items: [
          "No Core Downloader in the Online Updater? Arch, CachyOS, Debian and Ubuntu packages hide it. Either install the Flatpak (flatpak install flathub org.libretro.RetroArch), whose Core Downloader works, or install the core by hand as below.",
          "By hand on Arch or CachyOS: download bsnes_mercury_performance_libretro.so.zip from the libretro buildbot (linux/x86_64/latest), unzip it, and copy the .so to /usr/lib/libretro/ (sudo install -m644 bsnes_mercury_performance_libretro.so /usr/lib/libretro/).",
          "On Debian or Ubuntu: sudo apt install libretro-bsnes-mercury-performance.",
          "retroarch.cfg lives in ~/.config/retroarch/ (Flatpak: ~/.var/app/org.libretro.RetroArch/config/retroarch/).",
          "The AppImage from retroarch.com keeps its Core Downloader. With a RetroArch.AppImage.home folder next to the AppImage, it uses that folder as its home: retroarch.cfg and the cores then live in RetroArch.AppImage.home/.config/retroarch/.",
        ],
        links: [
          {
            label: "libretro buildbot, Linux x86_64",
            url: `${BUILDBOT}linux/x86_64/latest/`,
          },
        ],
        sources: [
          "https://gitlab.archlinux.org/archlinux/packaging/packages/retroarch/-/raw/main/retroarch-config.patch",
          "https://salsa.debian.org/games-team/libretro/retroarch/-/raw/master/debian/patches/01_config.patch",
          "https://github.com/flathub/org.libretro.RetroArch",
          "https://docs.appimage.org/user-guide/portable-mode.html",
          RA_CFG_DOC,
        ],
        title: "RetroArch on Linux",
        unverified: [
          "That CachyOS ships Arch's RetroArch package unchanged.",
          "That the core info file is installed with Arch's RetroArch (check /usr/share/libretro/info/bsnes_mercury_performance_libretro.info).",
        ],
        when: { device: ["retroarch", "unknown"], os: ["linux"] },
      },
      {
        items: [
          "retroarch.cfg sits next to retroarch.exe, or in %APPDATA%. Main Menu, Configuration File, Save Current Configuration shows where.",
          "The Steam version has no Core Downloader and no bsnes-mercury DLC: use the standalone RetroArch.",
        ],
        links: [
          {
            label: "RetroArch downloads",
            url: "https://www.retroarch.com/?page=platforms",
          },
        ],
        sources: [RA_CFG_DOC, "https://www.libretro.com/?p=48812"],
        title: "RetroArch on Windows",
        when: { device: ["retroarch", "unknown"], os: ["windows"] },
      },
      {
        items: [
          "Main Menu, Configuration File, Save Current Configuration shows where retroarch.cfg is.",
          "The Steam version has no Core Downloader and no bsnes-mercury DLC: use the standalone RetroArch.",
        ],
        links: [],
        sources: [
          "https://docs.libretro.com/guides/change-directories/",
          "https://www.libretro.com/?p=48812",
        ],
        title: "RetroArch on macOS",
        when: { device: ["retroarch", "unknown"], os: ["macos"] },
      },
      {
        items: [
          "Use firmware 1.11.0 or later: usb2snes support is built in.",
          "Connect the cart over USB and power the console on.",
        ],
        links: [
          {
            label: "sd2snes firmware",
            url: "https://github.com/mrehkopf/sd2snes/blob/master/CHANGELOG",
          },
        ],
        sources: [
          "https://github.com/mrehkopf/sd2snes/blob/master/CHANGELOG",
          SNI_README,
        ],
        title: "FX Pak Pro",
        when: { device: ["fxpakpro", "unknown"] },
      },
      {
        items: [
          "Linux needs SNI's udev rule, which the download does not include: get linux/udev/rules.d/51-fxpak.rules from the SNI repository, then run sudo cp 51-fxpak.rules /etc/udev/rules.d/, sudo udevadm control --reload and sudo udevadm trigger.",
        ],
        links: [
          {
            label: "51-fxpak.rules",
            url: "https://github.com/alttpo/sni/blob/main/linux/udev/rules.d/51-fxpak.rules",
          },
        ],
        sources: [SNI_README, "https://github.com/alttpo/sni/issues/41"],
        title: "FX Pak Pro on Linux",
        when: { device: ["fxpakpro", "unknown"], os: ["linux"] },
      },
      {
        items: [
          "BizHawk 2.9 or later: Config, Preferred Cores, SNES, BSNESv115+, then reload the ROM.",
          "Tools, Lua Console, then open lua/Connector.lua from the SNI folder.",
        ],
        links: [
          { label: "BizHawk", url: "https://github.com/TASEmulators/BizHawk" },
        ],
        sources: [
          "https://github.com/alttpo/sni/blob/77ba8ac44ec63fc1c5f41549b6da9851085790a2/lua/Connector.lua",
          "https://archipelago.gg/tutorial/A%20Link%20to%20the%20Past/multiworld/en",
        ],
        title: "BizHawk",
        unverified: ["The exact menu wording in BizHawk 2.11."],
        when: { device: ["luabridge", "unknown"], os: ["windows", "linux"] },
      },
      {
        items: [
          "Emulators with network access (snes9x-nwa on Windows, bsnes-plus-nwa on Windows and macOS) are found automatically on ports 48879 to 48888.",
        ],
        links: [{ label: "NWA emulators", url: "https://usb2snes.com/nwa/" }],
        sources: [
          SNI_README,
          "https://github.com/Skarsnik/snes9x-emunwa/releases",
          "https://github.com/black-sliver/bsnes-plus/releases",
        ],
        title: "NWA emulators",
        when: { device: ["emunwa", "unknown"] },
      },
    ],
  },
  {
    done: BRIDGE_REACHED,
    failing: [
      "local-network-prompt",
      "local-network-denied",
      "browser-blocks-bridge",
    ],
    id: "permission",
    title: "Allow the connection in the browser",
    variants: [
      {
        items: [
          'When the browser asks to "Access other apps and services on this device", click Allow.',
          'Blocked by mistake? Click the icon left of the address, then set "Apps on device" to Allow, and reload.',
        ],
        links: [],
        sources: [CHROME_147, CHROME_145],
        title: "Chrome, Edge and other Chromium browsers",
        unverified: [
          'The site settings label "Apps on device", reported by secondary sources.',
        ],
        when: { browser: ["chromium"] },
      },
      {
        items: [
          'When Firefox asks to reach "Device apps and services", click Allow.',
          "Blocked by mistake? Settings, Privacy & Security, Permissions, Device apps and services, Settings…, then set this site to Allow.",
          "A block looks like a stopped SNI: if SNI is running, check this setting first.",
        ],
        links: [
          {
            label: "Mozilla: device and local network permissions",
            url: FIREFOX_LNA,
          },
        ],
        sources: [FIREFOX_LNA, FIREFOX_154],
        title: "Firefox",
        unverified: [
          "The exact labels: Mozilla's article could only be read through a search snippet.",
        ],
        when: { browser: ["firefox"] },
      },
      {
        items: [
          "Safari and every iOS browser refuse connections from a secure site to this computer (ws://localhost counts as mixed content). Use Firefox, Chrome or Edge on a computer.",
        ],
        links: [{ label: "WebKit bug 171934", url: WEBKIT_171934 }],
        sources: [WEBKIT_171934],
        title: "Safari",
        when: { browser: ["safari"] },
      },
    ],
  },
  {
    done: ["connected"],
    failing: ["game-mismatch", "memory-unreadable:no-content"],
    id: "game",
    title: "Load the game",
    variants: [
      {
        items: [
          "Start the ROM from the {game} playlist, so bsnes-mercury runs it.",
        ],
        links: [],
        sources: [RA_LABELS],
        title: "RetroArch",
        when: { device: ["retroarch"] },
      },
      {
        items: ["Boot the ROM from the cart's menu."],
        links: [],
        sources: [SNI_README],
        title: "FX Pak Pro",
        when: { device: ["fxpakpro"] },
      },
      {
        items: [
          "Load the {game} ROM and leave it running; the tracker checks it every few seconds.",
        ],
        links: [],
        sources: [],
        title: "Other emulators",
        when: { device: ["luabridge", "emunwa", "snes-classic", "unknown"] },
      },
    ],
  },
];

export type StepState = "done" | "failing" | "pending";

export interface StepProgress {
  readonly step: SetupStep;
  readonly state: StepState;
  /** The variants that apply to this environment and device. */
  readonly variants: readonly SetupVariant[];
}

export interface SetupProgress {
  readonly steps: readonly StepProgress[];
  /** The step the UI should open: the first failing one, else the first pending. */
  readonly focus: SetupStepId | null;
}

/** The keys a status matches in `done` / `failing`. */
export function statusKeys(status: SessionStatus): readonly StatusKey[] {
  return status.code === "memory-unreadable"
    ? [status.code, `${status.code}:${status.cause}`]
    : [status.code];
}

function matches(
  condition: SetupCondition,
  env: Environment | null,
  device: DeviceKind | null,
): boolean {
  const fits = <T>(
    allowed: readonly T[] | undefined,
    value: T | null | undefined,
  ) =>
    allowed === undefined ||
    value === null ||
    value === undefined ||
    allowed.includes(value);
  return (
    fits(condition.os, env?.os) &&
    fits(condition.arch, env?.arch === "unknown" ? null : env?.arch) &&
    fits(condition.browser, env?.browser) &&
    fits(condition.device, device)
  );
}

function deviceOf(status: SessionStatus): DeviceKind | null {
  switch (status.code) {
    case "attaching":
    case "attach-failed":
      return status.device.kind;
    case "memory-unreadable":
    case "game-mismatch":
    case "connected":
      return status.device.device.kind;
    default:
      return null;
  }
}

/**
 * Each step's state for the current status, with the variants that fit the
 * environment (null: show every variant) and the device in use, if known.
 * `game` is the name the text uses for the game, from the pack.
 */
export function setupProgress(
  status: SessionStatus,
  env: Environment | null,
  options: {
    readonly game?: string;
    readonly steps?: readonly SetupStep[];
  } = {},
): SetupProgress {
  const game = options.game ?? "Randomizer";
  const steps = options.steps ?? SETUP_STEPS;
  const named = (variant: SetupVariant): SetupVariant => ({
    ...variant,
    items: variant.items.map((item) => item.replaceAll("{game}", game)),
  });
  const keys = statusKeys(status);
  const device = deviceOf(status);
  const progress = steps.map((step) => {
    const state: StepState = keys.some((key) => step.failing.includes(key))
      ? "failing"
      : keys.some((key) => step.done.includes(key))
        ? "done"
        : "pending";
    return {
      state,
      step,
      variants: step.variants
        .filter((variant) => matches(variant.when, env, device))
        .map(named),
    };
  });
  const focus =
    progress.find((p) => p.state === "failing") ??
    progress.find((p) => p.state === "pending");
  return { focus: focus?.step.id ?? null, steps: progress };
}
