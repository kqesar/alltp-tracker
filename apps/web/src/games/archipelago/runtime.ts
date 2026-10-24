// The Archipelago session as the board runs it, a chunk of its own loaded on
// Connect (the stream view never loads it): the package's session, the names
// it needs, the feed it folds and the run it writes. Every change of the
// session's snapshot, and every feed line, pokes one write at most every
// 250 ms, so a burst (a Release sends hundreds of items and lines at once)
// renders and persists once.

import {
  ArchipelagoSession,
  emptyFeed,
  type FeedState,
  feedEvent,
  foldFeed,
  lineGames,
  loadLocationGroups,
  type NameData,
  NameDataLoader,
  type NetworkItem,
  type PageContext,
  resolveLine,
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
import {
  type AwayItem,
  awayItems,
  namesOf,
  neededForRun,
  projectRun,
} from "@/games/archipelago/project";
import {
  type ApFeedEntry,
  type ApRoom,
  type ApServerRun,
  FEED_KEPT,
  sameRun,
} from "@/games/archipelago/store";
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
  /** The run on the board: its feed goes on, its items say what is new. */
  board?: {
    room: ApRoom | null;
    received: number;
    feed: readonly ApFeedEntry[];
  };
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
  /** The items received since the board's run, once a connection resent them. */
  away: (items: AwayItem[]) => void;
  /** The room's countdown reached 0, now. */
  countdown: (at: number) => void;
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
  /** Name data by game, as loaded; the slot's own first. */
  const loaded = new Map<string, NameData>();
  /** Games asked for, so each is asked once per runtime unless it failed. */
  const asked = new Set<string>();
  const names = (game: string | undefined) =>
    game === undefined ? null : (loaded.get(game) ?? null);
  let checksum = options.checksum;
  let written = "";
  let stopped = false;

  /** The board's run: what "while you were away" counts from. */
  let known = {
    received: options.board?.received ?? 0,
    room: options.board?.room ?? null,
  };
  /** The board's feed lines, written out already; this session's go on after them. */
  let base: readonly ApFeedEntry[] = options.board?.feed ?? [];
  const nextSeq = () => (base.at(-1)?.seq ?? -1) + 1;
  let feed: FeedState = emptyFeed(nextSeq());
  /** The items received since the board's run, until shown. */
  let away: NetworkItem[] | null = null;
  let awayShown = "";
  /** A Connected came: its ReceivedItems at index 0 says what is new. */
  let awaitingList = false;

  const resolvedFeed = (): ApFeedEntry[] => {
    const by = namesOf(session.snapshot, names);
    const lines = feed.lines.map((line) => {
      const entry = resolveLine(line, by);
      return { ...entry, parts: [...entry.parts] };
    });
    return [...base, ...lines].slice(-FEED_KEPT);
  };

  /** Ask for each game a line, a hint or a sent item needs, once. */
  const want = (game: string) => {
    if (asked.has(game) || session.status.code !== "connected") return;
    asked.add(game);
    loader.load(game, session.snapshot.room?.checksums[game]).then(
      (data) => {
        if (stopped) return;
        loaded.set(game, data);
        batch.poke();
      },
      () => asked.delete(game),
    );
  };

  const write = () => {
    const { snapshot } = session;
    const gameOf = namesOf(snapshot, () => null).game;
    for (const line of feed.lines) {
      for (const game of lineGames(line, gameOf)) want(game);
    }
    for (const game of neededForRun(snapshot, away ?? [])) want(game);
    const run = projectRun(snapshot, names, checksum, resolvedFeed());
    if (run === null) return;
    if (away !== null) {
      const items = awayItems(snapshot, away, names);
      const text = JSON.stringify(items);
      if (text !== awayShown) {
        awayShown = text;
        sink.away(items);
      }
    }
    checksum = run.room?.checksum ?? checksum;
    // The same run's list only grows: the moment between Connected and the
    // list the server resends says nothing of what the board had
    if (
      known.room === null ||
      run.room === null ||
      !sameRun(known.room, run.room) ||
      run.received >= known.received
    ) {
      known = { received: run.received, room: run.room };
    }
    const text = JSON.stringify(run);
    if (text === written) return;
    written = text;
    sink.run(run);
  };
  const batch = trailing(BATCH_MS, write);
  session.onSnapshot((_, reset) => {
    if (reset) {
      // Another run: its feed starts afresh, and nothing was "away"
      base = [];
      feed = emptyFeed();
      away = null;
    }
    batch.poke();
  });

  session.onPacket((packet) => {
    if (stopped) return;
    if (packet.cmd === "Connected") {
      awaitingList = true;
      // The board's feed was another run's: this one's starts afresh
      const { identity } = session.snapshot;
      const room = known.room;
      if (
        identity !== null &&
        room !== null &&
        !sameRun(room, { ...room, ...identity })
      ) {
        base = [];
        feed = emptyFeed();
        away = null;
      }
    }
    if (packet.cmd === "ReceivedItems" && packet.index === 0 && awaitingList) {
      awaitingList = false;
      const { identity, items } = session.snapshot;
      const room = known.room;
      if (
        identity !== null &&
        room !== null &&
        sameRun(room, { ...room, ...identity }) &&
        items.length > known.received
      ) {
        away = items.slice(known.received);
      }
    }
    const event = feedEvent(packet);
    const me = session.snapshot.identity?.slot;
    if (event === null || me === undefined) return;
    feed = foldFeed(feed, event, me);
    if (event.kind === "countdown" && event.value === 0) {
      sink.countdown(Date.now());
    }
    batch.poke();
  });

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
    asked.add(game);
    const failed = () => {
      // The next connection asks again
      if (loading === key) loading = null;
      asked.delete(game);
    };
    loader.load(game, sum).then((data) => {
      if (stopped) return;
      loaded.set(game, data);
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
    if (status.code === "connected") {
      // The list the server resends comes in Connected's own frame, before
      // this: a later index 0 is a slot's first item ever, nothing missed
      awaitingList = false;
      loadNames();
      batch.poke();
    }
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
