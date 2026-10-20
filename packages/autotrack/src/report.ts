// A plain-text report the user can copy into a bug report or a Discord
// message: what ran, what was found, what went wrong. It holds no ROM name,
// no file path beyond device ids, no User-Agent string.

import type { SessionStatus } from "./diagnostics";
import type { Environment } from "./environment";
import type { BridgeInfo, DeviceDescriptor } from "./transport";
import { AUTOTRACK_VERSION } from "./version";

/** One English sentence for a status, for the report and for UIs. */
export function describeStatus(status: SessionStatus): string {
  switch (status.code) {
    case "idle":
      return "Autotracking has not started.";
    case "connecting":
      return `Connecting to the bridge at ${status.url} (attempt ${status.attempt}).`;
    case "local-network-prompt":
      return "The browser is asking whether this site may reach apps on this device.";
    case "local-network-denied":
      return `The browser blocked access to apps on this device (permission "${status.permission.name ?? "unknown"}": ${status.permission.state}).`;
    case "browser-blocks-bridge":
      return "This browser does not let a secure site connect to this computer.";
    case "bridge-unreachable":
      return `Nothing answered at ${status.url}: nothing listens there, or the browser blocked the connection (${status.detail}).`;
    case "bridge-refused":
      return `The bridge refused this site (${status.detail}).`;
    case "no-device":
      return `${bridgeName(status.bridge)} is running but sees no emulator or console.`;
    case "attaching":
      return `Attaching to ${status.device.id}.`;
    case "attach-failed":
      return `${bridgeName(status.bridge)} could not attach to ${status.device.id} (${status.detail}).`;
    case "memory-unreadable":
      return `${status.device.device.id} does not let the tracker read memory: ${status.cause} (${status.evidence}; ${status.detail}).`;
    case "game-mismatch":
      return `${status.check.message} (${status.check.code})`;
    case "connected":
      return `Connected to ${status.device.device.id}; Race Mode ${status.race.active ? "on" : "off"}${status.paused ? "; paused while the page is hidden" : ""}.`;
    case "stopped":
      return "Autotracking is stopped.";
  }
}

function bridgeName(bridge: BridgeInfo): string {
  const name =
    bridge.kind === "sni"
      ? "SNI"
      : bridge.kind === "qusb2snes"
        ? "QUsb2Snes"
        : bridge.kind === "retroarch"
          ? "RetroArch"
          : "The bridge";
  return bridge.version === null ? name : `${name} ${bridge.version}`;
}

export interface ReportInput {
  readonly status: SessionStatus;
  /** Clock time the status was entered. */
  readonly statusSince: number;
  readonly bridge: BridgeInfo | null;
  readonly devices: readonly DeviceDescriptor[];
  readonly environment: Environment | null;
  /** Clock time the report is made. */
  readonly now: number;
}

/** The copyable report. Times are ISO 8601, UTC. */
export function diagnosticReport(input: ReportInput): string {
  const { bridge, environment: env, status } = input;
  const lines = [
    "Rando Atlas autotracking report",
    `package: @alltp/autotrack ${AUTOTRACK_VERSION}`,
    `time: ${new Date(input.now).toISOString()}`,
    env === null
      ? "environment: unknown"
      : `environment: ${env.os} ${env.arch}${env.archSource === "unknown" ? " (CPU not reported)" : ""}, ${env.browserName ?? env.browser} ${env.browserMajor ?? "?"}, loopback ${env.loopback}`,
    bridge === null
      ? "bridge: not reached"
      : `bridge: ${bridge.kind} ${bridge.version ?? "(version unknown)"} at ${bridge.url}`,
    `devices: ${input.devices.length === 0 ? "none listed" : input.devices.map((d) => `${d.id} (${d.kind})`).join(", ")}`,
    `status: ${status.code} since ${new Date(input.statusSince).toISOString()}`,
    `message: ${describeStatus(status)}`,
  ];
  if (status.code === "memory-unreadable") {
    lines.push(`remedy: ${status.remedy.action}`);
  }
  if (
    status.code === "memory-unreadable" ||
    status.code === "game-mismatch" ||
    status.code === "connected"
  ) {
    const info = status.device;
    lines.push(
      `device info: ${info.name ?? "?"} ${info.version ?? "?"}, rom ${info.rom === null ? "not loaded" : "loaded"}, flags ${info.flags.length === 0 ? "none" : info.flags.join(" ")}`,
    );
  }
  if (status.code === "connected") {
    const race = status.race;
    lines.push(
      `race: setting ${race.setting}, flag ${race.flag}, active ${race.active}, legal ${race.raceLegal}${race.overridden ? ", overridden" : ""}`,
    );
    if (status.unreadable.length > 0)
      lines.push(`unreadable ranges: ${status.unreadable.join(", ")}`);
  }
  if ("retryInMs" in status) {
    lines.push(
      `next retry: ${status.retryInMs === null ? "waiting for the user" : `in ${status.retryInMs} ms`}`,
    );
  }
  return `${lines.join("\n")}\n`;
}
