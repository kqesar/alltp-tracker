// What an AP 0.6.8 server answers, replayed from a recorded fixture: the
// in-memory fake socket and the fake server (test/fake-ap-server.ts) both
// answer through it, so the session meets the server's real packets.
import { dataPackage, type Fixture } from "./fixtures";

type Packet = Record<string, unknown>;

/**
 * Where the bench's own Sync answer sits in `later()` frames (the last
 * ReceivedItems at index 0): replaying up to it leaves a spec's own Sync as
 * the only way to the whole list.
 */
export function recordedSync(frames: readonly Packet[][]): number {
  let at = -1;
  frames.forEach((frame, index) => {
    if (frame[0]?.cmd === "ReceivedItems" && frame[0]?.index === 0) at = index;
  });
  if (at <= 0) throw new Error("No recorded Sync answer");
  return at;
}

export interface ResponderOptions {
  readonly fixture: Fixture;
  /** The recorded client whose conversation is replayed. */
  readonly client: string;
  /** Answer Connect with ConnectionRefused and these reasons. */
  readonly refuse?: readonly string[];
  /** Never answer this stage: no RoomInfo, no reply to Connect, or to Get. */
  readonly hang?: "room-info" | "login" | "get";
}

export class ApResponder {
  /** Every packet the client sent, in order. */
  readonly received: Packet[] = [];
  /** The slot's received items, as the server would resend them on Sync. */
  items: unknown[] = [];
  private readonly options: ResponderOptions;
  private readonly storage = new Map<string, unknown>();

  constructor(options: ResponderOptions) {
    this.options = options;
    for (const frame of options.fixture.frames) {
      if (frame.dir !== "in") continue;
      for (const packet of frame.packets ?? []) {
        if (packet.cmd === "Retrieved") {
          for (const [key, value] of Object.entries(
            packet.keys as Record<string, unknown>,
          )) {
            this.storage.set(key, value);
          }
        }
      }
    }
  }

  private frames(): readonly { dir: string; packets?: readonly Packet[] }[] {
    return this.options.fixture.frames.filter(
      (frame) => frame.client === this.options.client,
    );
  }

  /** The first frame on connection: RoomInfo. */
  greeting(): Packet[][] {
    if (this.options.hang === "room-info") return [];
    const first = this.frames().find(
      (frame) => frame.dir === "in" && frame.packets?.[0]?.cmd === "RoomInfo",
    );
    if (first === undefined) throw new Error("No RoomInfo recorded");
    return [[...(first.packets ?? [])]];
  }

  /**
   * The in-frames recorded right after the client's Connect, up to its next
   * packet ("answer"), and every in-frame after those ("later").
   */
  private split(): { answer: Packet[][]; later: Packet[][] } {
    const frames = this.frames();
    const start = frames.findIndex(
      (frame) =>
        frame.dir === "out" &&
        (frame.packets ?? []).some((packet) => packet.cmd === "Connect"),
    );
    const answer: Packet[][] = [];
    const later: Packet[][] = [];
    let answering = true;
    for (const frame of frames.slice(start + 1)) {
      if (frame.dir === "out") answering = false;
      if (frame.dir === "in") {
        (answering ? answer : later).push([...(frame.packets ?? [])]);
      }
    }
    return { answer, later };
  }

  /** The frames recorded after the login answer, for a spec to push. */
  later(): Packet[][] {
    return this.split().later;
  }

  /** What the server answers to one client packet. */
  answer(packet: Packet): Packet[][] {
    this.received.push(packet);
    switch (packet.cmd) {
      case "Connect": {
        if (this.options.hang === "login") return [];
        if (this.options.refuse !== undefined) {
          return [
            [{ cmd: "ConnectionRefused", errors: [...this.options.refuse] }],
          ];
        }
        const { answer } = this.split();
        this.track(answer);
        return answer;
      }
      case "Get": {
        if (this.options.hang === "get") return [];
        const keys: Record<string, unknown> = {};
        for (const key of packet.keys as string[]) {
          keys[key] = this.storage.has(key) ? this.storage.get(key) : null;
        }
        return [[{ cmd: "Retrieved", keys, uuid: packet.uuid }]];
      }
      case "SetNotify":
        return [];
      case "GetDataPackage": {
        const games: Record<string, unknown> = {};
        for (const game of packet.games as string[]) {
          const { archipelago: _a, game: _g, ...body } = dataPackage(game);
          games[game] = body;
        }
        return [[{ cmd: "DataPackage", data: { games } }]];
      }
      case "Sync":
        return this.items.length === 0
          ? []
          : [[{ cmd: "ReceivedItems", index: 0, items: [...this.items] }]];
      default:
        return [
          [
            {
              cmd: "InvalidPacket",
              original_cmd: packet.cmd,
              text: "not answered by the fake server",
              type: "cmd",
            },
          ],
        ];
    }
  }

  /** Keeps `items` in step with ReceivedItems the client is sent. */
  track(frames: readonly Packet[][]): void {
    for (const frame of frames) {
      for (const packet of frame) {
        if (packet.cmd !== "ReceivedItems") continue;
        const list = packet.items as unknown[];
        this.items = packet.index === 0 ? [...list] : [...this.items, ...list];
      }
    }
  }
}
