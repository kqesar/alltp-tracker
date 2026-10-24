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
  type NameData,
  nameData,
  type WebSocketLike,
} from "@alltp/archipelago";
import { setRuntimeOptions } from "@/games/archipelago/connection";
import { mappedNames, type Skin } from "@/games/archipelago/worlds/skin";

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
  options: { refuse?: string[]; client?: string; fixture?: string } = {},
) => {
  const network = new Network().route(ROOM_URL, {
    kind: "serve",
    responder: {
      client: options.client ?? "tracker",
      fixture: fixture(options.fixture ?? "normal-session"),
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

/** A world's names, as the room's data package gives them. */
export const worldNames = (game: string) => {
  const { archipelago: _a, game: _g, ...pkg } = dataPackage(game);
  return nameData(game, pkg as unknown as GamePackage);
};

/** A Link to the Past's names, as the room's data package gives them. */
export const alttpNames = () => worldNames("A Link to the Past");

/**
 * What a skin gets wrong against its world's pinned name data, each list
 * empty when nothing: names it maps or excludes that the data lacks,
 * progression items with neither a cell nor an exclusion, exclusions a cell
 * counts anyway, rows not `columns` long, cells placed twice or never, and
 * locations its groups name that the data lacks, leave out or hold twice.
 * @param progression - The world's progression items, read from AP's source
 */
export const skinProblems = (
  skin: Skin,
  names: NameData,
  progression: readonly string[],
) => {
  const mapped = mappedNames(skin);
  const placed = [...skin.layout, ...(skin.extraRows ?? [])].flat();
  const grouped = Object.values(skin.groups ?? {}).flat();
  const seen = new Set<string>();
  const twice = grouped.filter((name) => seen.has(name) || !seen.add(name));
  return {
    excludedMapped: Object.keys(skin.excluded).filter((n) => mapped.has(n)),
    groupedTwice: twice,
    misplaced: [
      ...placed.filter((id, index) => placed.indexOf(id) !== index),
      ...skin.cells.map((cell) => cell.id).filter((id) => !placed.includes(id)),
    ],
    shortRows: [...skin.layout, ...(skin.extraRows ?? [])]
      .map((row) => row.length)
      .filter((length) => length !== skin.columns),
    uncovered: progression.filter(
      (name) => !mapped.has(name) && !Object.hasOwn(skin.excluded, name),
    ),
    ungrouped:
      skin.groups === undefined
        ? []
        : [...names.locationIds.keys()].filter((name) => !seen.has(name)),
    unknownGrouped: grouped.filter((name) => !names.locationIds.has(name)),
    unknownItems: [...mapped, ...Object.keys(skin.excluded)].filter(
      (name) => !names.itemIds.has(name),
    ),
    unknownProgression: progression.filter((name) => !names.itemIds.has(name)),
  };
};

/** No problem found by `skinProblems`. */
export const NO_PROBLEM = {
  excludedMapped: [],
  groupedTwice: [],
  misplaced: [],
  shortRows: [],
  uncovered: [],
  ungrouped: [],
  unknownGrouped: [],
  unknownItems: [],
  unknownProgression: [],
};
