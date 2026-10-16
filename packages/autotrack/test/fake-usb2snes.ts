// An in-process usb2snes server for tests, on `ws` (Node 22 ships a
// WebSocket client, not a server). It speaks the protocol the way SNI
// (services/usb2snes/usb2snes.go) and QUsb2Snes (core/wsservercommands.cpp)
// do, over a 16 MiB FX Pak Pro memory image, and can be told to fail the
// ways real bridges do.
import type { AddressInfo } from "node:net";
import { type WebSocket, WebSocketServer } from "ws";

export interface FakeDevice {
  /** What DeviceList returns, e.g. "ra://127.0.0.1:55355". */
  readonly id: string;
  /** Info's Results: version, device name, ROM, flags... */
  readonly info: readonly string[];
}

/** What the server does with a GetAddress, by default "serve". */
export type ReadBehaviour =
  /** Reply with the bytes. */
  | "serve"
  /** SNI when it cannot detect the mapping: drop the socket (1006). */
  | "drop"
  /** Send half the bytes, then drop. */
  | "drop-mid-read"
  /** QUsb2Snes on a device error: close 1000 with a reason. */
  | { readonly closeWith: string }
  /** Never answer. */
  | "hang";

export interface Request {
  readonly Opcode: string;
  readonly Space?: string;
  readonly Operands?: readonly string[];
}

export interface FakeOptions {
  readonly appVersion?: string;
  readonly devices?: readonly FakeDevice[];
  /** QUsb2Snes's untrusted-origin refusal (1008) on every connection. */
  readonly refuseOrigin?: boolean;
  /** Split binary replies into messages of this size (QUsb2Snes, sd2snes). */
  readonly chunk?: number;
  /** Delay before each reply. */
  readonly replyDelayMs?: number;
}

export const SNI_RETROARCH: FakeDevice = {
  id: "ra://127.0.0.1:55355",
  info: ["1.22.2", "retroarch", "alttpr - seed"],
};

export class FakeUsb2Snes {
  readonly memory = new Uint8Array(0x100_0000);
  /** Every request, in arrival order. */
  readonly requests: Request[] = [];
  /** Every GetAddress piece, as [address, size]. */
  readonly reads: [number, number][] = [];
  devices: readonly FakeDevice[];
  read: ReadBehaviour = "serve";
  appVersion: string;
  refuseOrigin: boolean;
  chunk: number | undefined;
  replyDelayMs: number;
  /** Set when a request arrived while another was unanswered. */
  overlapped = false;
  private readonly sockets = new Set<WebSocket>();
  private connectionsOpened = 0;

  private constructor(
    private readonly server: WebSocketServer,
    options: FakeOptions,
  ) {
    this.devices = options.devices ?? [SNI_RETROARCH];
    this.appVersion = options.appVersion ?? "SNI-v0.0.103";
    this.refuseOrigin = options.refuseOrigin ?? false;
    this.chunk = options.chunk;
    this.replyDelayMs = options.replyDelayMs ?? 0;
    server.on("connection", (socket) => this.accept(socket));
  }

  static start(options: FakeOptions = {}): Promise<FakeUsb2Snes> {
    return new Promise((resolve) => {
      const server = new WebSocketServer({ host: "127.0.0.1", port: 0 }, () => {
        resolve(new FakeUsb2Snes(server, options));
      });
    });
  }

  get url(): string {
    const { port } = this.server.address() as AddressInfo;
    return `ws://127.0.0.1:${port}`;
  }

  /** Open connections right now. */
  get connections(): number {
    return this.sockets.size;
  }

  /** Connections accepted since start. */
  get accepted(): number {
    return this.connectionsOpened;
  }

  opcodes(): string[] {
    return this.requests.map((r) => r.Opcode);
  }

  /** Drops every connection, as a crashed bridge would. */
  dropAll(): void {
    for (const socket of this.sockets) socket.terminate();
  }

  async stop(): Promise<void> {
    this.dropAll();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  private accept(socket: WebSocket): void {
    this.connectionsOpened++;
    this.sockets.add(socket);
    socket.on("close", () => this.sockets.delete(socket));
    if (this.refuseOrigin) {
      socket.close(1008, "Not in trusted origin");
      return;
    }
    let busy = false;
    let attached: FakeDevice | null = null;
    socket.on("message", (data, isBinary) => {
      if (isBinary) return;
      const request = JSON.parse(String(data)) as Request;
      this.requests.push(request);
      const replies = request.Opcode !== "Attach" && request.Opcode !== "Name";
      if (replies && busy) this.overlapped = true;
      if (replies) busy = true;
      const done = () => {
        busy = false;
      };
      const reply = (send: () => void) => {
        const run = () => {
          if (socket.readyState !== socket.OPEN) return;
          send();
          done();
        };
        if (this.replyDelayMs > 0) setTimeout(run, this.replyDelayMs);
        else run();
      };
      const json = (results: readonly string[]) =>
        reply(() => socket.send(JSON.stringify({ Results: results })));
      switch (request.Opcode) {
        case "AppVersion":
          json([this.appVersion]);
          return;
        case "Name":
          return;
        case "DeviceList":
          json(this.devices.map((d) => d.id));
          return;
        case "Attach": {
          const id = request.Operands?.[0];
          attached = this.devices.find((d) => d.id === id) ?? null;
          if (attached === null) socket.terminate();
          return;
        }
        case "Info":
          if (attached === null) {
            socket.terminate();
            return;
          }
          json(attached.info);
          return;
        case "GetAddress":
          this.getAddress(socket, request, reply);
          return;
        default:
          socket.terminate();
      }
    });
  }

  private getAddress(
    socket: WebSocket,
    request: Request,
    reply: (send: () => void) => void,
  ): void {
    const operands = request.Operands ?? [];
    const pieces: [number, number][] = [];
    for (let i = 0; i < operands.length; i += 2) {
      pieces.push([
        Number.parseInt(operands[i], 16),
        Number.parseInt(operands[i + 1], 16),
      ]);
    }
    this.reads.push(...pieces);
    const behaviour = this.read;
    if (behaviour === "hang") return;
    if (behaviour === "drop") {
      socket.terminate();
      return;
    }
    if (typeof behaviour === "object") {
      socket.close(1000, behaviour.closeWith);
      return;
    }
    const total = pieces.reduce((sum, [, size]) => sum + size, 0);
    const bytes = new Uint8Array(total);
    let at = 0;
    for (const [address, size] of pieces) {
      bytes.set(this.memory.subarray(address, address + size), at);
      at += size;
    }
    reply(() => {
      if (behaviour === "drop-mid-read") {
        socket.send(bytes.subarray(0, Math.floor(total / 2)), { binary: true });
        socket.terminate();
        return;
      }
      const chunk = this.chunk ?? total;
      for (let from = 0; from < total; from += chunk) {
        socket.send(bytes.subarray(from, Math.min(total, from + chunk)), {
          binary: true,
        });
      }
    });
  }
}
