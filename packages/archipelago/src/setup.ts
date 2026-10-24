// The "Connect to a room" guide as data: ordered steps, each with the
// session states that mark it done or failing, and content variants per
// page (the site or the desktop app), room (archipelago.gg or self-hosted),
// browser and address class. `setupProgress()` derives each step's state
// from the live status, so the UI can tick steps and open the first failing
// one; a step no variant fits is left out (the browser's permission, on the
// desktop app). The README's "Setup guide" is written from this file.

import {
  type AddressClass,
  type BrowserFamily,
  CHROMIUM_SETTING,
} from "./address";
import type { SessionStatus } from "./diagnostics";

export type SetupStepId =
  | "address"
  | "permission"
  | "reach"
  | "slot"
  | "password";

/** Where the tracker runs, as the guide distinguishes it. */
export type SetupPage = "site" | "desktop";
/** Where the room is hosted. */
export type SetupHost = "archipelago.gg" | "self-hosted";

/** When a variant applies; an absent field matches anything. */
export interface SetupCondition {
  readonly page?: readonly SetupPage[];
  readonly host?: readonly SetupHost[];
  /** The browser family; a context that does not know it matches none. */
  readonly browser?: readonly BrowserFamily[];
  /** Where the server sits; a context without an address matches none. */
  readonly where?: readonly AddressClass[];
}

/** What the guide is read for. */
export interface SetupContext {
  readonly page: SetupPage;
  readonly host: SetupHost;
  readonly browser?: BrowserFamily | null;
  readonly where?: AddressClass | null;
}

export interface SetupLink {
  readonly label: string;
  readonly url: string;
}

export interface SetupVariant {
  readonly when: SetupCondition;
  readonly title: string;
  /** Instructions, one per item, in English, in order. */
  readonly items: readonly string[];
  readonly links: readonly SetupLink[];
  readonly sources: readonly string[];
}

/** A session code, or "refused:" and a reason for the refusals that belong to different steps. */
export type StatusKey = string;

export interface SetupStep {
  readonly id: SetupStepId;
  readonly title: string;
  readonly done: readonly StatusKey[];
  readonly failing: readonly StatusKey[];
  readonly variants: readonly SetupVariant[];
}

const ROOM_PAGE_SOURCE =
  "archipelago.gg room page, fetched 2026-10-24: it prints `/connect archipelago.gg:<port>`";
const BENCH =
  'packages/archipelago README, "Addresses and connectivity" (measured 2026-10-24)';
const DESKTOP_RELEASES =
  "https://github.com/kqesar/alltp-tracker/releases/latest";
const CHROME_147 = "https://developer.chrome.com/release-notes/147";
const CHROME_145 = "https://developer.chrome.com/release-notes/145";
const CHROMIUM_LABELS =
  "chromium/chromium components/site_settings_strings.grdp at 344811fd4389c1eaf5594996b1c21b7174004364";
const FIREFOX_LNA =
  "https://support.mozilla.org/en-US/kb/control-personal-device-local-network-permissions-firefox";
const WEBKIT_171934 = "https://bugs.webkit.org/show_bug.cgi?id=171934";
const DESKTOP_LINK = { label: "Desktop app", url: DESKTOP_RELEASES };

/** Every status past the browser: the server answered. */
const SERVER_ANSWERED = ["authenticating", "connected", "refused"];

export const SETUP_STEPS: readonly SetupStep[] = [
  {
    done: ["connecting", "authenticating", "connected", "refused"],
    failing: [],
    id: "address",
    title: "Find the room's address",
    variants: [
      {
        items: [
          "Open the room's page on archipelago.gg.",
          "Paste the page's link, or the line under it that starts with /connect.",
        ],
        links: [],
        sources: [ROOM_PAGE_SOURCE],
        title: "archipelago.gg",
        when: { host: ["archipelago.gg"] },
      },
      {
        items: [
          "Ask the host for the server's address and port, such as 192.168.1.20:38281.",
          "Add wss:// in front only if the host set up TLS; otherwise ws:// or nothing.",
        ],
        links: [],
        sources: ["MultiServer.py: --host, --port, --cert"],
        title: "Self-hosted",
        when: { host: ["self-hosted"] },
      },
    ],
  },
  {
    done: SERVER_ANSWERED,
    failing: [
      "local-network-prompt",
      "local-network-denied",
      "blocked-browser",
    ],
    id: "permission",
    title: "Allow the connection in the browser",
    variants: [
      {
        items: [
          'When the browser asks to "Access other apps and services on this device", click Allow.',
          `Blocked by mistake? Click the icon left of the address, set "${CHROMIUM_SETTING["loopback-network"]}" to Allow, and the tracker connects.`,
        ],
        links: [],
        sources: [CHROME_147, CHROME_145, CHROMIUM_LABELS, BENCH],
        title: "Chrome, Edge and other Chromium browsers",
        when: {
          browser: ["chromium"],
          host: ["self-hosted"],
          page: ["site"],
          where: ["loopback"],
        },
      },
      {
        items: [
          "When the browser asks to let this site reach devices on your local network, click Allow.",
          `Blocked by mistake? Click the icon left of the address, set "${CHROMIUM_SETTING["local-network"]}" to Allow, and the tracker connects.`,
        ],
        links: [],
        sources: [CHROME_145, CHROMIUM_LABELS, BENCH],
        title: "Chrome, Edge and other Chromium browsers",
        when: {
          browser: ["chromium"],
          host: ["self-hosted"],
          page: ["site"],
          where: ["private"],
        },
      },
      {
        items: [
          "Firefox reached a server on this computer without asking (Firefox 157). If it asks to reach apps on this device, click Allow.",
        ],
        links: [
          {
            label: "Mozilla: device and local network permissions",
            url: FIREFOX_LNA,
          },
        ],
        sources: [FIREFOX_LNA, BENCH],
        title: "Firefox",
        when: {
          browser: ["firefox"],
          host: ["self-hosted"],
          page: ["site"],
          where: ["loopback"],
        },
      },
      {
        items: [
          "Firefox does not let a secure site reach a ws:// server on your local network.",
          "Use Chrome or Edge, which ask first, or the desktop app.",
        ],
        links: [DESKTOP_LINK],
        sources: [BENCH],
        title: "Firefox",
        when: {
          browser: ["firefox"],
          host: ["self-hosted"],
          page: ["site"],
          where: ["private"],
        },
      },
      {
        items: [
          "Safari and every iOS browser refuse ws:// from a secure site to this computer or your network.",
          "Use the desktop app, or Chrome or Edge on a computer.",
        ],
        links: [
          DESKTOP_LINK,
          { label: "WebKit bug 171934", url: WEBKIT_171934 },
        ],
        sources: [WEBKIT_171934],
        title: "Safari",
        when: {
          browser: ["safari"],
          host: ["self-hosted"],
          page: ["site"],
          where: ["loopback", "private"],
        },
      },
    ],
  },
  {
    done: [
      "authenticating",
      "connected",
      "refused:InvalidSlot",
      "refused:InvalidPassword",
    ],
    failing: [
      "blocked-insecure",
      "unreachable",
      "timeout",
      "refused:IncompatibleVersion",
    ],
    id: "reach",
    title: "Reach the server",
    variants: [
      {
        items: [
          "archipelago.gg rooms are encrypted (wss://) and work from any browser.",
          "A room that has been idle for hours is paused: open its page to wake it, then retry.",
        ],
        links: [],
        sources: [BENCH],
        title: "archipelago.gg",
        when: { host: ["archipelago.gg"] },
      },
      {
        items: [
          "A secure site cannot reach an unencrypted ws:// server on the internet: ask the host for a wss:// address, or use the desktop app.",
          "On this computer or your network, Chrome and Edge ask to allow it first; Firefox reaches this computer only; Safari neither.",
          "The desktop app reaches any server.",
        ],
        links: [DESKTOP_LINK],
        sources: [BENCH],
        title: "Self-hosted, from the site",
        when: { host: ["self-hosted"], page: ["site"] },
      },
      {
        items: ["The desktop app reaches ws:// and wss:// servers alike."],
        links: [],
        sources: [BENCH],
        title: "Self-hosted, from the desktop app",
        when: { host: ["self-hosted"], page: ["desktop"] },
      },
    ],
  },
  {
    done: ["connected", "refused:InvalidPassword"],
    failing: ["refused:InvalidSlot"],
    id: "slot",
    title: "Your slot name",
    variants: [
      {
        items: [
          "Type your slot name exactly as the room lists it: case matters.",
          "With a room link, pick it from the list instead.",
          "The tracker joins as a tracker, never as a player: it cannot send checks or items.",
          'Everyone in the room sees it join and leave ("… tracking … has joined").',
        ],
        links: [],
        sources: [
          "MultiServer.py: InvalidSlot; Join and Part messages (test/fixtures/normal-session.json)",
        ],
        title: "Slot name",
        when: {},
      },
    ],
  },
  {
    done: ["connected"],
    failing: ["refused:InvalidPassword"],
    id: "password",
    title: "Password, if the room has one",
    variants: [
      {
        items: [
          "Leave it empty unless the host set one.",
          "It stays on this device: it is never shared, exported or put in a report.",
        ],
        links: [],
        sources: [
          "MultiServer.py: InvalidPassword (test/fixtures/password.json)",
        ],
        title: "Password",
        when: {},
      },
    ],
  },
];

/** The keys a status matches steps by. */
export function statusKeys(status: SessionStatus): StatusKey[] {
  if (status.code === "refused") {
    return status.reasons
      .map((reason) => `refused:${reason}`)
      .concat("refused");
  }
  return [status.code];
}

export type StepState = "done" | "failing" | "pending";

export interface StepProgress {
  readonly step: SetupStep;
  readonly state: StepState;
  readonly variants: readonly SetupVariant[];
}

export interface SetupProgress {
  readonly steps: readonly StepProgress[];
  /** The step to open: the first failing, else the first pending. */
  readonly focus: SetupStepId | null;
}

/** Whether `value` is one `allowed` lists; any value when nothing is listed. */
const within = <T>(
  allowed: readonly T[] | undefined,
  value: T | null | undefined,
) =>
  allowed === undefined ||
  (value !== null && value !== undefined && allowed.includes(value));

function matches(when: SetupCondition, context: SetupContext) {
  return (
    within(when.page, context.page) &&
    within(when.host, context.host) &&
    within(when.browser, context.browser) &&
    within(when.where, context.where)
  );
}

export function setupProgress(
  status: SessionStatus,
  context: SetupContext,
  steps: readonly SetupStep[] = SETUP_STEPS,
): SetupProgress {
  const keys = statusKeys(status);
  const progress = steps
    .map((step) => ({
      state: (keys.some((key) => step.failing.includes(key))
        ? "failing"
        : keys.some((key) => step.done.includes(key))
          ? "done"
          : "pending") as StepState,
      step,
      variants: step.variants.filter((variant) =>
        matches(variant.when, context),
      ),
    }))
    .filter((entry) => entry.variants.length > 0);
  const focus =
    progress.find((p) => p.state === "failing") ??
    progress.find((p) => p.state === "pending");
  return { focus: focus?.step.id ?? null, steps: progress };
}
