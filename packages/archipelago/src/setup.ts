// The "Connect to a room" guide as data: ordered steps, each with the
// session states that mark it done or failing, and content variants per
// page (the site or the desktop app) and room (archipelago.gg or
// self-hosted). `setupProgress()` derives each step's state from the live
// status, so the UI can tick steps and open the first failing one. The
// README's "Setup guide" is written from this file.

import type { SessionStatus } from "./diagnostics";

export type SetupStepId = "address" | "reach" | "slot" | "password";

/** Where the tracker runs, as the guide distinguishes it. */
export type SetupPage = "site" | "desktop";
/** Where the room is hosted. */
export type SetupHost = "archipelago.gg" | "self-hosted";

/** When a variant applies; an absent field matches anything. */
export interface SetupCondition {
  readonly page?: readonly SetupPage[];
  readonly host?: readonly SetupHost[];
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
    done: [
      "authenticating",
      "connected",
      "refused:InvalidSlot",
      "refused:InvalidPassword",
    ],
    failing: [
      "blocked-insecure",
      "blocked-browser",
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
          "A secure site cannot reach an unencrypted ws:// server on the internet.",
          "On this computer or your network, Chrome and Edge ask to allow local network access; Firefox reaches this computer only; Safari neither.",
          "The desktop app reaches any server.",
        ],
        links: [{ label: "Desktop app", url: DESKTOP_RELEASES }],
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

function matches(when: SetupCondition, page: SetupPage, host: SetupHost) {
  return (
    (when.page === undefined || when.page.includes(page)) &&
    (when.host === undefined || when.host.includes(host))
  );
}

export function setupProgress(
  status: SessionStatus,
  context: { readonly page: SetupPage; readonly host: SetupHost },
  steps: readonly SetupStep[] = SETUP_STEPS,
): SetupProgress {
  const keys = statusKeys(status);
  const progress = steps.map((step) => ({
    state: (keys.some((key) => step.failing.includes(key))
      ? "failing"
      : keys.some((key) => step.done.includes(key))
        ? "done"
        : "pending") as StepState,
    step,
    variants: step.variants.filter((variant) =>
      matches(variant.when, context.page, context.host),
    ),
  }));
  const focus =
    progress.find((p) => p.state === "failing") ??
    progress.find((p) => p.state === "pending");
  return { focus: focus?.step.id ?? null, steps: progress };
}
