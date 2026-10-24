// An in-memory WebSocket and network for the session specs: the real
// archipelago.js Client runs on it, under the specs' ManualClock, with no
// port opened. Events are delivered on a later turn, as a browser does.
import type { WebSocketLike } from "../src/platform";
import { ApResponder, type ResponderOptions } from "./responder";

type Listener = (event: unknown) => void;

/** How the fake network treats a URL. */
export type Route =
  /** Open, then answer through a responder. */
  | { readonly kind: "serve"; readonly responder: ResponderOptions }
  /** Fail at once (1006): nothing listens there. */
  | { readonly kind: "unreachable" }
  /** Never open, never fail: a black hole. */
  | { readonly kind: "black-hole" }
  /** Throw from the constructor, as a browser does for mixed content. */
  | { readonly kind: "security-error" };

const later = (run: () => void) => setImmediate(run);

export class FakeSocket implements WebSocketLike {
  readyState = 0;
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { readonly data: unknown }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onclose:
    | ((event: { readonly code: number; readonly reason: string }) => void)
    | null = null;
  /** Every frame the client sent, as text. */
  readonly sent: string[] = [];
  /** Packets the client sent, parsed. */
  readonly packets: Record<string, unknown>[] = [];
  readonly responder: ApResponder | null;
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(
    readonly url: string,
    route: Route,
  ) {
    this.responder =
      route.kind === "serve" ? new ApResponder(route.responder) : null;
    if (route.kind === "serve") {
      later(() => {
        if (this.readyState !== 0) return;
        this.readyState = 1;
        this.fire("open", {});
        this.deliver(this.responder?.greeting() ?? []);
      });
    } else if (route.kind === "unreachable") {
      later(() => this.drop());
    }
  }

  addEventListener(type: string, listener: Listener): void {
    let set = this.listeners.get(type);
    if (set === undefined) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
  }

  private fire(type: string, event: unknown): void {
    const handler = (this as unknown as Record<string, unknown>)[`on${type}`];
    if (typeof handler === "function") handler.call(this, event);
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  send(data: string): void {
    if (this.readyState !== 1) throw new Error("socket not open");
    this.sent.push(data);
    const packets = JSON.parse(data) as Record<string, unknown>[];
    this.packets.push(...packets);
    if (this.responder === null) return;
    const answers = packets.flatMap(
      (packet) => this.responder?.answer(packet) ?? [],
    );
    later(() => this.deliver(answers));
  }

  /** The server sends these frames, each a list of packets. */
  deliver(frames: readonly unknown[][]): void {
    for (const frame of frames) {
      if (this.readyState !== 1) return;
      this.responder?.track([frame as Record<string, unknown>[]]);
      this.fire("message", { data: JSON.stringify(frame) });
    }
  }

  close(code = 1005, reason = ""): void {
    if (this.readyState >= 2) return;
    this.readyState = 3;
    later(() => this.fire("close", { code, reason, wasClean: true }));
  }

  /** The connection fails or is cut from the server's side (1006). */
  drop(): void {
    if (this.readyState >= 2) return;
    this.readyState = 3;
    this.fire("error", {});
    this.fire("close", { code: 1006, reason: "", wasClean: false });
  }
}

export class FakeNetwork {
  readonly sockets: FakeSocket[] = [];
  private readonly routes = new Map<string, Route>();
  private fallback: Route = { kind: "unreachable" };

  /** Routes a URL (with scheme and port); "*" for any other. */
  route(url: string, route: Route): this {
    if (url === "*") this.fallback = route;
    else this.routes.set(url, route);
    return this;
  }

  readonly factory = (url: string): WebSocketLike => {
    // archipelago.js passes a URL object, which prints a trailing slash.
    const route = this.routes.get(url.replace(/\/$/, "")) ?? this.fallback;
    if (route.kind === "security-error") {
      const error = new Error(
        "An insecure WebSocket connection may not be initiated",
      );
      error.name = "SecurityError";
      throw error;
    }
    const socket = new FakeSocket(url, route);
    this.sockets.push(socket);
    return socket;
  };

  /** The socket opened last. */
  get last(): FakeSocket {
    const socket = this.sockets.at(-1);
    if (socket === undefined) throw new Error("No socket opened");
    return socket;
  }

  /** Sockets not closed yet. */
  get open(): FakeSocket[] {
    return this.sockets.filter((socket) => socket.readyState < 2);
  }
}
