// An in-process Archipelago server for tests, on `ws` (Node 22 ships a
// WebSocket client, not a server). It replays what AP 0.6.8 sent in a
// recorded fixture (test/responder.ts) and can be told to fail the ways a
// real room does: refuse the slot, never send RoomInfo, never answer
// Connect, cut the connection.
import type { AddressInfo } from "node:net";
import { type WebSocket, WebSocketServer } from "ws";
import { ApResponder, type ResponderOptions } from "./responder";

export interface FakeApServerOptions extends ResponderOptions {
  /** The port to listen on; by default, one the system picks. */
  readonly port?: number;
}

export class FakeApServer {
  /** One responder per connection, in arrival order. */
  readonly responders: ApResponder[] = [];
  private readonly sockets = new Set<WebSocket>();

  private constructor(
    private readonly server: WebSocketServer,
    private readonly options: FakeApServerOptions,
  ) {
    server.on("connection", (socket) => {
      this.sockets.add(socket);
      socket.on("close", () => this.sockets.delete(socket));
      const responder = new ApResponder(this.options);
      this.responders.push(responder);
      const send = (frames: readonly unknown[][]) => {
        for (const frame of frames) socket.send(JSON.stringify(frame));
      };
      send(responder.greeting());
      socket.on("message", (data) => {
        const packets = JSON.parse(String(data)) as Record<string, unknown>[];
        for (const packet of packets) send(responder.answer(packet));
      });
    });
  }

  static async start(options: FakeApServerOptions): Promise<FakeApServer> {
    const server = new WebSocketServer({
      host: "127.0.0.1",
      port: options.port ?? 0,
    });
    await new Promise<void>((resolve) => server.once("listening", resolve));
    return new FakeApServer(server, options);
  }

  get port(): number {
    return (this.server.address() as AddressInfo).port;
  }

  get url(): string {
    return `ws://127.0.0.1:${this.port}`;
  }

  /** Connections open now. */
  get connections(): number {
    return this.sockets.size;
  }

  /** Every packet clients sent, across connections. */
  get received(): Record<string, unknown>[] {
    return this.responders.flatMap((responder) => responder.received);
  }

  /** Sends these frames to every connected client. */
  push(frames: readonly unknown[][]): void {
    for (const responder of this.responders) {
      responder.track(frames as Record<string, unknown>[][]);
    }
    for (const socket of this.sockets) {
      for (const frame of frames) socket.send(JSON.stringify(frame));
    }
  }

  /** Cuts every connection without a closing handshake (1006 on the client). */
  drop(): void {
    for (const socket of this.sockets) socket.terminate();
  }

  async close(): Promise<void> {
    this.drop();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }
}
