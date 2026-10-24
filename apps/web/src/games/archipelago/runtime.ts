// The Archipelago session as the board runs it, a chunk of its own loaded on
// Connect (the stream view never loads it): the package's session, the names
// it needs and the run it writes. Every change of the session's snapshot
// pokes one write at most every 250 ms, so a burst of items (a Release sends
// hundreds at once) renders and persists once.

import {
  ArchipelagoSession,
  loadLocationGroups,
  type NameData,
  NameDataLoader,
  type PageContext,
  type ServerAddress,
  type SessionStatus,
  type TabLock,
  type Timeouts,
  type WebSocketFactory,
} from "@alltp/archipelago";
import type {
  LocationGroups,
  NameCache,
} from "@/games/archipelago/datapackageCache";
import { projectRun } from "@/games/archipelago/project";
import type { ApServerRun } from "@/games/archipelago/store";
import { trailing } from "@/utils/trailing";

/** The longest wait between the server's word and the run's write. */
export const BATCH_MS = 250;

export type RuntimeOptions = {
  address: ServerAddress;
  slot: string;
  password: string;
  page: PageContext;
  /** This device's id in the room. */
  uuid: string;
  lock: TabLock;
  cache: NameCache;
  /** The checksum the saved run knows, kept until the room says one. */
  checksum: string | null;
  /** Tests' own sockets and timers. */
  webSocket?: WebSocketFactory;
  timeouts?: Partial<Timeouts>;
};

/** Where the runtime reports to (connection.ts). */
export type RuntimeSink = {
  status: (status: SessionStatus, since: number) => void;
  run: (run: Omit<ApServerRun, "updatedAt">) => void;
  names: (names: NameData) => void;
  groups: (groups: LocationGroups) => void;
};

export type Runtime = {
  retryNow: () => void;
  /** Writes what is pending, then stops: no socket or timer survives. */
  stop: () => void;
};

export const startRuntime = (
  options: RuntimeOptions,
  sink: RuntimeSink,
): Runtime => {
  const session = new ArchipelagoSession({
    address: options.address,
    lock: options.lock,
    page: options.page,
    password: options.password,
    slot: options.slot,
    uuid: options.uuid,
    ...(options.webSocket ? { webSocket: options.webSocket } : {}),
    ...(options.timeouts ? { timeouts: options.timeouts } : {}),
  });
  const loader = new NameDataLoader({
    fetch: (game) => session.getDataPackage(game),
    store: options.cache,
  });
  let names: NameData | null = null;
  let checksum = options.checksum;
  let written = "";
  let stopped = false;

  const write = () => {
    const run = projectRun(session.snapshot, names, checksum);
    if (run === null) return;
    checksum = run.room?.checksum ?? checksum;
    const text = JSON.stringify(run);
    if (text === written) return;
    written = text;
    sink.run(run);
  };
  const batch = trailing(BATCH_MS, write);
  session.onSnapshot(() => batch.poke());

  /** The game and checksum whose names are loaded or loading. */
  let loading: string | null = null;
  const loadNames = () => {
    const { identity, room } = session.snapshot;
    if (identity === null) return;
    const { game } = identity;
    const sum = room?.checksums[game];
    const key = `${game}\n${sum ?? ""}`;
    if (loading === key) return;
    loading = key;
    const failed = () => {
      // The next connection asks again
      if (loading === key) loading = null;
    };
    loader.load(game, sum).then((data) => {
      if (stopped) return;
      names = data;
      sink.names(data);
      batch.poke();
    }, failed);
    loadLocationGroups(game, (keys) => session.get(keys)).then((groups) => {
      if (stopped) return;
      sink.groups(groups);
      if (sum !== undefined) void options.cache.putGroups(game, sum, groups);
    }, failed);
  };

  session.subscribe((status) => {
    if (stopped) return;
    sink.status(status, session.statusSince);
    if (status.code === "connected") loadNames();
  });
  session.start();

  return {
    retryNow: () => session.retryNow(),
    stop: () => {
      if (stopped) return;
      batch.cancel();
      write();
      stopped = true;
      session.stop();
    },
  };
};
