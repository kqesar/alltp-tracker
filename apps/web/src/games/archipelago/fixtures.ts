// Fixtures for the Archipelago board's specs, not part of the app: a room on
// the package's in-memory network, answering as AP 0.6.8 did in the bench's
// recording (packages/archipelago/test/), and the names that recording's
// world gives.
//
// The package's test helpers run on Node (they read the fixtures from disk),
// and the app's types know no Node: they are imported by a computed address,
// which the type checker does not follow, and typed here for what the specs
// use of them.

import {
  type GamePackage,
  nameData,
  type WebSocketLike,
} from "@alltp/archipelago";
import { setRuntimeOptions } from "@/games/archipelago/connection";

/** A socket of the package's in-memory network (test/fake-socket.ts). */
type FakeSocket = WebSocketLike & {
  readonly packets: Record<string, unknown>[];
  readonly responder: { later(): unknown[][] } | null;
  deliver(frames: readonly unknown[][]): void;
};

type Route = {
  kind: "serve";
  responder: { client: string; fixture: unknown; refuse?: string[] };
};

type FakeNetwork = {
  readonly sockets: FakeSocket[];
  readonly last: FakeSocket;
  readonly factory: (url: string) => WebSocketLike;
  route(url: string, route: Route): FakeNetwork;
};

const helper = (file: string) =>
  import(
    /* @vite-ignore */ new URL(
      `../../../../../packages/archipelago/test/${file}`,
      import.meta.url,
    ).href
  );

const { FakeNetwork: Network } = (await helper("fake-socket.ts")) as {
  FakeNetwork: new () => FakeNetwork;
};
const { dataPackage, fixture } = (await helper("fixtures.ts")) as {
  dataPackage: (game: string) => Record<string, unknown>;
  fixture: (name: string) => unknown;
};

/** Where the specs' room listens. */
export const ROOM_URL = "ws://127.0.0.1:38281";
export const ROOM_ADDRESS = "127.0.0.1:38281";

/**
 * A room the next sessions reach, replaying the bench's tracker on Link (A
 * Link to the Past).
 * @param options - Refuse the Connect with these reasons
 */
export const startRoom = (
  options: { refuse?: string[]; client?: string } = {},
) => {
  const network = new Network().route(ROOM_URL, {
    kind: "serve",
    responder: {
      client: options.client ?? "tracker",
      fixture: fixture("normal-session"),
      ...(options.refuse ? { refuse: options.refuse } : {}),
    },
  });
  setRuntimeOptions({ webSocket: network.factory });
  return {
    network,
    /** The game goes on: the frames recorded after the login. */
    playOn: () => {
      const socket = network.last;
      socket.deliver(socket.responder?.later() ?? []);
    },
  };
};

/** A Link to the Past's names, as the room's data package gives them. */
export const alttpNames = () => {
  const {
    archipelago: _a,
    game: _g,
    ...pkg
  } = dataPackage("A Link to the Past");
  return nameData("A Link to the Past", pkg as unknown as GamePackage);
};
