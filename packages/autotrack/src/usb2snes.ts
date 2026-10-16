// The usb2snes WebSocket protocol, as SNI (services/usb2snes/usb2snes.go)
// and QUsb2Snes (docs/Protocol.md, core/wsservercommands.cpp) serve it on
// ws://localhost:23074:
// - requests are JSON text frames {Opcode, Space, Operands};
// - JSON replies are {Results: [...]}; GetAddress replies with raw bytes,
//   in one binary message (SNI) or several (QUsb2Snes, by device);
// - replies carry no request id, so one request is in flight at a time;
// - an error closes the socket: SNI drops it without a close frame (code
//   1006), QUsb2Snes closes it with code 1000 and the error text as reason.

import { hex } from "./address";
import { TransportError, type TransportOperation } from "./errors";
import { type PlannedRequest, type ReadLimits, USB2SNES_LIMITS } from "./plan";
import {
  type Clock,
  systemClock,
  systemWebSocket,
  type WebSocketFactory,
  type WebSocketLike,
} from "./platform";
import type {
  BridgeInfo,
  BridgeKind,
  DeviceDescriptor,
  DeviceInfo,
  DeviceKind,
  Transport,
} from "./transport";

export const DEFAULT_USB2SNES_URL = "ws://localhost:23074";

export interface Usb2SnesTimeouts {
  /** Socket open. Long: a browser permission prompt holds it open. */
  readonly open: number;
  /** SNI probes every driver on DeviceList; RetroArch answers per frame. */
  readonly deviceList: number;
  readonly reply: number;
}

export interface Usb2SnesOptions {
  readonly url?: string;
  /** Sent with `Name`; SNI and QUsb2Snes show it in their client lists. */
  readonly clientName?: string;
  readonly socket?: WebSocketFactory;
  readonly clock?: Clock;
  readonly timeouts?: Partial<Usb2SnesTimeouts>;
}

const DEFAULT_TIMEOUTS: Usb2SnesTimeouts = {
  deviceList: 10_000,
  open: 60_000,
  reply: 5_000,
};

const OPEN = 1;

interface Job {
  readonly message: string;
  readonly operation: TransportOperation;
  readonly expect: "none" | "json" | "binary";
  readonly timeout: number;
  readonly resolve: (results: readonly string[] | null) => void;
  readonly reject: (error: TransportError) => void;
  readonly into?: Uint8Array;
  readonly offset?: number;
  readonly size?: number;
  received: number;
}

/** The kind of device a DeviceList entry names (see DeviceKind). */
export function deviceKind(id: string): DeviceKind {
  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(id)?.[1]?.toLowerCase();
  switch (scheme) {
    case "ra":
      return "retroarch";
    case "fxpakpro":
      return "fxpakpro";
    case "luabridge":
      return "luabridge";
    case "emunwa":
      return "emunwa";
    case undefined:
      break;
    default:
      return "unknown";
  }
  if (id.startsWith("SD2SNES ")) return "fxpakpro";
  if (id.startsWith("RetroArch")) return "retroarch";
  if (id.startsWith("Emu - ")) return "luabridge";
  if (id === "SNES Classic") return "snes-classic";
  return "unknown";
}

/** QUsb2Snes's Info device names (devices/*.cpp parseInfo) to kinds. */
function kindFromInfoName(name: string | null): DeviceKind {
  switch (name) {
    case "SD2SNES":
      return "fxpakpro";
    case "RetroArch":
    case "retroarch":
      return "retroarch";
    case "BizHawk":
    case "Snes9x":
      return "luabridge";
    case "NWAccess":
      return "emunwa";
    case "SNES Classic":
      return "snes-classic";
    default:
      return "unknown";
  }
}

function bridgeOf(version: string): {
  kind: BridgeKind;
  version: string | null;
} {
  // SNI v0.0.103 answers "SNI-v0.0.103" (observed against a running SNI);
  // QUsb2Snes "QUsb2Snes-0.7.42". The "v" is dropped so versions compare
  // with SNI_LATEST_KNOWN.
  const match = /^(SNI|QUsb2Snes)-v?(.+)$/i.exec(version.trim());
  if (match === null) return { kind: "unknown", version: version || null };
  return {
    kind: match[1].toLowerCase() === "sni" ? "sni" : "qusb2snes",
    version: match[2],
  };
}

/**
 * Info's ROM field with the placeholders turned into null: SNI's fallback
 * "No Info" (usb2snes.go, when FetchFields fails: RetroArch without content)
 * and the FX Pak Pro menu, "/sd2snes/menu.bin" (docs/Protocol.md).
 */
function romOf(value: string | undefined): string | null {
  if (value === undefined || value === "" || value === "No Info") return null;
  if (value.toLowerCase().endsWith("/sd2snes/menu.bin")) return null;
  return value;
}

export class Usb2SnesTransport implements Transport {
  readonly limits: ReadLimits = USB2SNES_LIMITS;
  private readonly url: string;
  private readonly clientName: string;
  private readonly createSocket: WebSocketFactory;
  private readonly clock: Clock;
  private readonly timeouts: Usb2SnesTimeouts;
  private socket: WebSocketLike | null = null;
  private opened = false;
  private closed = false;
  private readonly queue: Job[] = [];
  private current: Job | null = null;
  private timer: unknown = null;
  private closeListener: ((error: Error) => void) | null = null;
  private pendingOpen: {
    readonly reject: (error: TransportError) => void;
    readonly timer: unknown;
  } | null = null;
  /** GetAddress JSON per planned request, built on first use. */
  private readonly wire = new WeakMap<PlannedRequest, string>();

  constructor(options: Usb2SnesOptions = {}) {
    this.url = options.url ?? DEFAULT_USB2SNES_URL;
    this.clientName = options.clientName ?? "alltp-tracker";
    this.createSocket = options.socket ?? systemWebSocket;
    this.clock = options.clock ?? systemClock;
    this.timeouts = { ...DEFAULT_TIMEOUTS, ...options.timeouts };
  }

  open(): Promise<BridgeInfo> {
    return new Promise<void>((resolve, reject) => {
      const unreachable = (closeCode?: number, reason?: string) =>
        new TransportError(
          "unreachable",
          "open",
          `No bridge answered at ${this.url}`,
          { closeCode, reason },
        );
      let socket: WebSocketLike;
      try {
        socket = this.createSocket(this.url);
      } catch (error) {
        reject(unreachable(undefined, String(error)));
        return;
      }
      this.socket = socket;
      socket.binaryType = "arraybuffer";
      const timer = this.clock.setTimeout(
        () => this.shutdown(unreachable(undefined, "timeout")),
        this.timeouts.open,
      );
      this.pendingOpen = { reject, timer };
      socket.onopen = () => {
        this.clock.clearTimeout(timer);
        this.pendingOpen = null;
        this.opened = true;
        resolve();
      };
      // A refused connection fires "error" then "close" in browsers, but
      // "error" alone in Node 22's WebSocket: either one ends the attempt.
      // Before the socket opens the close code is always 1006, so nothing
      // is lost by not waiting for it. Once open, the close carries the code.
      socket.onerror = () => {
        if (!this.opened) this.shutdown(unreachable(undefined, "error"));
      };
      socket.onclose = (event) => {
        if (this.opened) this.onSocketClose(event.code, event.reason);
        else this.shutdown(unreachable(event.code, event.reason));
      };
      socket.onmessage = (event) => this.onMessage(event.data);
    }).then(async () => {
      const [version = ""] = await this.request(
        { Opcode: "AppVersion", Space: "SNES" },
        "app-version",
        "json",
      );
      this.post(
        { Opcode: "Name", Operands: [this.clientName], Space: "SNES" },
        "app-version",
      );
      return { ...bridgeOf(version), url: this.url };
    });
  }

  async listDevices(): Promise<readonly DeviceDescriptor[]> {
    const results = await this.request(
      { Opcode: "DeviceList", Space: "SNES" },
      "device-list",
      "json",
      this.timeouts.deviceList,
    );
    return results.map((id) => ({ id, kind: deviceKind(id) }));
  }

  async attach(device: DeviceDescriptor): Promise<DeviceInfo> {
    this.post(
      { Opcode: "Attach", Operands: [device.id], Space: "SNES" },
      "attach",
    );
    // Attach has no reply; a failure closes the socket, so the Info that
    // follows is what fails (docs/Protocol.md recommends it as the check).
    const [version, name, rom, ...flags] = await this.request(
      { Opcode: "Info", Space: "SNES" },
      "info",
      "json",
    );
    const infoName = name ?? null;
    return {
      device:
        device.kind === "unknown"
          ? { ...device, kind: kindFromInfoName(infoName) }
          : device,
      flags,
      name: infoName,
      rom: romOf(rom),
      romReadable: !flags.includes("NO_ROM_READ"),
      version: version ?? null,
    };
  }

  read(
    request: PlannedRequest,
    into: Uint8Array,
    offset: number,
  ): Promise<void> {
    let message = this.wire.get(request);
    if (message === undefined) {
      const operands: string[] = [];
      for (let i = 0; i < request.pieces.length; i += 2) {
        operands.push(hex(request.pieces[i], 6), hex(request.pieces[i + 1], 1));
      }
      message = JSON.stringify({
        Opcode: "GetAddress",
        Operands: operands,
        Space: "SNES",
      });
      this.wire.set(request, message);
    }
    return new Promise<void>((resolve, reject) => {
      this.enqueue({
        expect: "binary",
        into,
        message,
        offset,
        operation: "read",
        received: 0,
        reject,
        resolve: () => resolve(),
        size: request.size,
        timeout: this.timeouts.reply,
      });
    });
  }

  onClose(listener: (error: Error) => void): void {
    this.closeListener = listener;
  }

  close(): void {
    this.shutdown(
      new TransportError(
        "closed",
        this.current?.operation ?? "open",
        "Closed by the tracker",
      ),
    );
  }

  /** Sends a request that has no reply; a failure shows on the next one. */
  private post(body: object, operation: TransportOperation): void {
    this.enqueue({
      expect: "none",
      message: JSON.stringify(body),
      operation,
      received: 0,
      reject: () => {},
      resolve: () => {},
      timeout: 0,
    });
  }

  private request(
    body: object,
    operation: TransportOperation,
    expect: "json",
    timeout = this.timeouts.reply,
  ): Promise<readonly string[]> {
    return new Promise((resolve, reject) => {
      this.enqueue({
        expect,
        message: JSON.stringify(body),
        operation,
        received: 0,
        reject,
        resolve: (results) => resolve(results ?? []),
        timeout,
      });
    });
  }

  private enqueue(job: Job): void {
    if (this.closed || this.socket === null) {
      job.reject(
        new TransportError(
          "closed",
          job.operation,
          "The bridge connection is closed",
        ),
      );
      return;
    }
    this.queue.push(job);
    this.pump();
  }

  private pump(): void {
    while (this.current === null && this.queue.length > 0) {
      const job = this.queue.shift() as Job;
      const socket = this.socket;
      if (socket === null || socket.readyState !== OPEN) {
        job.reject(
          new TransportError(
            "closed",
            job.operation,
            "The bridge connection is closed",
          ),
        );
        continue;
      }
      socket.send(job.message);
      if (job.expect === "none") {
        job.resolve(null);
        continue;
      }
      this.current = job;
      this.timer = this.clock.setTimeout(() => {
        this.shutdown(
          new TransportError(
            "timeout",
            job.operation,
            `No reply to ${job.operation} in ${job.timeout} ms`,
          ),
        );
      }, job.timeout);
    }
  }

  private settle(): Job {
    const job = this.current as Job;
    this.current = null;
    this.clock.clearTimeout(this.timer);
    this.timer = null;
    return job;
  }

  private onMessage(data: unknown): void {
    const job = this.current;
    if (job === null) {
      this.shutdown(
        new TransportError(
          "protocol",
          "read",
          "The bridge sent an unrequested message",
        ),
      );
      return;
    }
    if (job.expect === "json") {
      let results: unknown;
      try {
        results =
          typeof data === "string" ? JSON.parse(data).Results : undefined;
      } catch {
        results = undefined;
      }
      if (
        !Array.isArray(results) ||
        !results.every((r) => typeof r === "string")
      ) {
        this.shutdown(
          new TransportError(
            "protocol",
            job.operation,
            "The bridge sent a malformed reply",
          ),
        );
        return;
      }
      this.settle().resolve(results);
      this.pump();
      return;
    }
    if (!(data instanceof ArrayBuffer)) {
      this.shutdown(
        new TransportError(
          "protocol",
          job.operation,
          "Expected binary data from the bridge",
        ),
      );
      return;
    }
    const size = job.size as number;
    if (job.received + data.byteLength > size) {
      this.shutdown(
        new TransportError(
          "protocol",
          job.operation,
          "The bridge sent more bytes than requested",
        ),
      );
      return;
    }
    (job.into as Uint8Array).set(
      new Uint8Array(data),
      (job.offset as number) + job.received,
    );
    job.received += data.byteLength;
    if (job.received === size) {
      this.settle().resolve(null);
      this.pump();
    }
  }

  private onSocketClose(code: number, reason: string): void {
    const operation = this.current?.operation ?? "read";
    this.shutdown(
      new TransportError(
        "closed",
        operation,
        `The bridge closed the connection${reason ? `: ${reason}` : ""}`,
        {
          closeCode: code,
          reason,
        },
      ),
    );
  }

  /** Rejects everything pending with `error` and closes the socket. */
  private shutdown(error: TransportError): void {
    if (this.closed) return;
    this.closed = true;
    const socket = this.socket;
    if (socket !== null) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
      if (socket.readyState <= OPEN) socket.close(1000, "closing");
    }
    const opening = this.pendingOpen;
    if (opening !== null) {
      this.pendingOpen = null;
      this.clock.clearTimeout(opening.timer);
      opening.reject(error);
    }
    if (this.current !== null) this.settle().reject(error);
    for (const job of this.queue.splice(0)) job.reject(error);
    const listener = this.closeListener;
    this.closeListener = null;
    if (this.opened && listener !== null) listener(error);
  }
}
