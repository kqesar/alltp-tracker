// One sentence per status, and a plain-text report the player can paste in a
// bug report or a Discord message. Neither holds the slot name, the password
// or the port: with the host, those three let anyone join the slot. The
// report keeps the host, which says whether the room is archipelago.gg.

import { libraryVersion, targetVersion } from "archipelago.js";
import {
  type AddressClass,
  type BrowserFamily,
  CHROMIUM_SETTING,
  type LocalNetworkPermissionName,
  type PageContext,
  type Reach,
  type ServerAddress,
} from "./address";
import type {
  RefusalReason,
  SessionStatus,
  UnreachableHint,
} from "./diagnostics";
import type { ApSnapshot } from "./snapshot";
import { ARCHIPELAGO_VERSION } from "./version";

/** The AP version archipelago.js announces in Connect (it is not ours to change). */
export const CLIENT_VERSION = `${targetVersion.major}.${targetVersion.minor}.${targetVersion.build}`;

/** `wss://archipelago.gg:•••••`: the host kept, the port masked. */
export function maskUrl(url: string): string {
  const match = /^(wss?:\/\/)?(\[[^\]]+\]|[^:/]+)/.exec(url);
  return match === null ? "(address)" : `${match[1] ?? ""}${match[2]}:•••••`;
}

/** The host alone, for sentences. */
function hostOf(url: string): string {
  return /^(?:wss?:\/\/)?(\[[^\]]+\]|[^:/]+)/.exec(url)?.[1] ?? "the server";
}

/** One sentence per refusal reason (MultiServer.py's ConnectionRefused). */
export function describeRefusal(
  reason: string,
  serverVersion: string | null,
): string {
  switch (reason as RefusalReason) {
    case "InvalidSlot":
      return "The room has no slot by that name. Slot names are case-sensitive: copy it from the room page.";
    case "InvalidPassword":
      return "The room needs a password, and this one is missing or wrong.";
    case "IncompatibleVersion":
      return serverVersion === null
        ? `The room refuses the Archipelago version the tracker announces (${CLIENT_VERSION}).`
        : `The room accepts only clients of its own Archipelago version (${serverVersion}), or one newer than the tracker announces (${CLIENT_VERSION}). Ask the host to allow other versions.`;
    case "InvalidItemsHandling":
      return "The server refused how the tracker asks for items: a tracker bug, please report it.";
    case "InvalidGame":
      return "The server refused the tracker's game field: a tracker bug, please report it.";
    default:
      return `The server refused the connection (${reason}).`;
  }
}

function describeUnreachable(hint: UnreachableHint, host: string): string {
  switch (hint) {
    case "offline":
      return "This device is offline.";
    case "room-paused":
      return "The room does not answer: it may be paused. Open its page on archipelago.gg to wake it.";
    case "no-tls":
      return `Nothing answered over wss:// at ${host}. A self-hosted server usually speaks ws:// only.`;
    case "not-running":
      return `Nothing answered at ${host}: is the server running, on that port?`;
    case "unknown":
      return `Nothing answered at ${host}.`;
  }
}

/** What a local network permission lets the site reach. */
function targetOf(where: LocalNetworkPermissionName | AddressClass): string {
  return where === "loopback-network" || where === "loopback"
    ? "this device"
    : "your local network";
}

const BROWSER_NAMES: Record<BrowserFamily, string> = {
  chromium: "This browser",
  firefox: "Firefox",
  other: "This browser",
  safari: "Safari, like every iOS browser,",
};

/** Where to go instead when this browser refuses ws:// to this class. */
function elsewhere(browser: BrowserFamily, where: AddressClass): string {
  if (browser === "safari") {
    return where === "loopback"
      ? "Use the desktop app, or Chrome, Edge or Firefox on a computer."
      : "Use the desktop app, or Chrome or Edge on a computer.";
  }
  return "Use Chrome or Edge, which ask first, or the desktop app.";
}

/** How to let the site in again: Chromium's own words, else where to look. */
function undoOf(
  browser: BrowserFamily,
  permission: LocalNetworkPermissionName,
): string {
  return browser === "chromium"
    ? `click the icon left of the address and set "${CHROMIUM_SETTING[permission]}" to Allow`
    : "allow it in the site's settings (the icon left of the address)";
}

/**
 * What will happen when the page reaches the server, and the way out, before
 * any socket opens (`reachOf`); null when nothing stands in the way.
 */
export function describeReach(reach: Reach): string | null {
  switch (reach.kind) {
    case "open":
      return null;
    case "ask":
      return reach.browser === "chromium"
        ? `The browser will ask to let this site reach ${targetOf(reach.permission)}: choose Allow.`
        : `If the browser asks to let this site reach ${targetOf(reach.permission)}, choose Allow.`;
    case "denied": {
      const target = targetOf(reach.permission);
      const undo = undoOf(reach.browser, reach.permission);
      return reach.state === "denied"
        ? `The browser blocks this site from reaching ${target}. To undo it, ${undo}, then ${reach.retry ? "Retry" : "Connect"}.`
        : `The browser did not let this site reach ${target}. Retry, and choose Allow when it asks; if it no longer asks, ${undo}.`;
    }
    case "blocked-insecure":
    case "blocked-browser":
      return blockedText(reach);
  }
}

function blockedText(
  reach: Extract<Reach, { kind: "blocked-insecure" | "blocked-browser" }>,
): string {
  return reach.kind === "blocked-insecure"
    ? "A secure site cannot open an unencrypted ws:// connection to a server on the internet. Ask the room's host for a wss:// address, or use the desktop app."
    : `${BROWSER_NAMES[reach.browser]} does not let a secure site reach a ws:// server on ${targetOf(reach.addressClass)}. ${elsewhere(reach.browser, reach.addressClass)}`;
}

/** One English sentence for a status, for the report and for UIs. */
export function describeStatus(status: SessionStatus): string {
  switch (status.code) {
    case "idle":
      return "Not connected to a room.";
    case "elsewhere":
      return "Connected in another tab of this browser; this one follows it.";
    case "blocked-insecure":
      return blockedText({ ...status, kind: status.code });
    case "blocked-browser":
      return blockedText({ ...status, kind: status.code });
    case "local-network-prompt":
      return `The browser is asking whether this site may reach ${targetOf(status.permission)}: choose Allow.`;
    case "local-network-denied":
      return status.state === "denied"
        ? `The browser blocks this site from reaching ${targetOf(status.permission)}. Allow it in the site's settings (the icon left of the address): the tracker connects once it is allowed.`
        : `The browser did not let this site reach ${targetOf(status.permission)}. Retry, and choose Allow when it asks.`;
    case "connecting":
      return status.stage === "socket"
        ? `Reaching ${hostOf(status.url)} (attempt ${status.attempt}).`
        : `Reached ${hostOf(status.url)}; waiting for the room.`;
    case "authenticating":
      return "Room reached; asking for the slot.";
    case "unreachable":
      return describeUnreachable(status.hint, hostOf(status.url));
    case "timeout":
      return status.stage === "keepalive"
        ? "The room stopped answering; reconnecting."
        : `${hostOf(status.url)} took too long to answer (${status.stage}).`;
    case "refused":
      return status.reasons
        .map((reason) => describeRefusal(reason, status.serverVersion))
        .join(" ");
    case "connected":
      return "Connected to the room.";
    case "reconnecting":
      return "The connection dropped; reconnecting.";
    case "unavailable":
      return `The Archipelago board could not load (${status.detail}).`;
    case "stopped":
      return status.detail === undefined
        ? "Disconnected."
        : `Stopped: ${status.detail}.`;
  }
}

/** Names a page context without the User-Agent string. */
function pageName(page: PageContext): string {
  return page.kind === "secure" ? `site (${page.browser})` : page.kind;
}

export interface ReportInput {
  readonly status: SessionStatus;
  /** Clock time the status was entered. */
  readonly statusSince: number;
  readonly page: PageContext;
  readonly address: ServerAddress | null;
  readonly snapshot: ApSnapshot | null;
  /** Clock time the report is made. */
  readonly now: number;
}

/** The copyable report. Times are ISO 8601, UTC. */
export function diagnosticReport(input: ReportInput): string {
  const { address, snapshot, status } = input;
  const room = snapshot?.room ?? null;
  const lines = [
    "Rando Atlas Archipelago report",
    `package: @alltp/archipelago, checked against Archipelago ${ARCHIPELAGO_VERSION}; archipelago.js ${libraryVersion}, announcing ${CLIENT_VERSION}`,
    `time: ${new Date(input.now).toISOString()}`,
    `page: ${pageName(input.page)}`,
    address === null
      ? "address: none"
      : `address: ${maskUrl(`${address.scheme === null ? "" : `${address.scheme}://`}${address.host}`)} (scheme ${address.scheme ?? "not given"})`,
    room === null
      ? "room: not reached"
      : `room: server ${room.serverVersion}, generator ${room.generatorVersion}, ${room.games.length} games, password ${room.passwordRequired ? "required" : "none"}`,
    snapshot?.identity == null
      ? "slot: not connected"
      : `slot: game ${snapshot.identity.game}, ${snapshot.items.length} items, ${snapshot.checked.length}/${snapshot.checked.length + snapshot.missing.length} checked, race ${snapshot.raceMode === null ? "unknown" : snapshot.raceMode ? "on" : "off"}`,
    `status: ${status.code} since ${new Date(input.statusSince).toISOString()}`,
    `message: ${describeStatus(status)}`,
  ];
  if ("url" in status) lines.push(`url: ${maskUrl(status.url)}`);
  if ("permission" in status) {
    lines.push(
      `permission: ${status.permission}${"state" in status ? ` (${status.state})` : " (asking)"}`,
    );
  }
  if (status.code === "refused") {
    lines.push(`reasons: ${status.reasons.join(", ")}`);
  }
  if ("retryInMs" in status) {
    lines.push(
      `next retry: ${status.retryInMs === null ? "waiting for the user" : `in ${status.retryInMs} ms`}`,
    );
  }
  return `${lines.join("\n")}\n`;
}
