import { parseUserAgent } from "@alltp/autotrack";
import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  FakeVisibility,
  GRANTED,
  ManualClock,
  SAVE,
  seedMemory,
} from "@/autotrack/fixtures";
import { checkSeed } from "@/autotrack/seed";
import {
  connectAutotrack,
  keepRunType,
  setAutotrackOptions,
  stopAutotrack,
  switchToSeed,
  syncFromGame,
  useAutotrackStore,
} from "@/stores/autotrackStore";
import { useGameStore } from "@/stores/gameStore";
import { MemoryTransport } from "../../../../packages/autotrack/test/memory-transport";
import { writeSeedSettings } from "../../../../packs/alttpr/test/seed-rom";

/** A console holding a seed in play, behind an in-memory bridge. */
const harness = ({
  name,
  race = false,
}: {
  name?: string;
  race?: boolean;
} = {}) => {
  const memory = seedMemory({ name, race });
  const clock = new ManualClock();
  setAutotrackOptions({
    clock,
    permission: GRANTED,
    random: () => 0,
    transport: () => new MemoryTransport(memory, {}),
    visibility: new FakeVisibility(),
  });
  return { advance: (ms: number) => act(() => clock.advance(ms)), memory };
};

const board = () => useGameStore.getState();

beforeEach(() => {
  localStorage.clear();
  act(() => {
    useGameStore.setState(useGameStore.getInitialState(), true);
    useAutotrackStore.setState(useAutotrackStore.getInitialState(), true);
    useAutotrackStore.setState({
      environment: parseUserAgent(
        "Mozilla/5.0 (X11; Linux x86_64; rv:158.0) Gecko/20100101 Firefox/158.0",
      ),
    });
  });
});

afterEach(() => {
  act(() => stopAutotrack());
  setAutotrackOptions({});
});

describe("autotracking and the board", () => {
  it("lays what it reads on the board as the game changes", async () => {
    const h = harness();
    await act(() => connectAutotrack());
    await h.advance(0);

    expect(board().items).toMatchObject({
      hookshot: true,
      moonpearl: false,
      sword: 2,
    });
    h.memory[SAVE(0x357)] = 0x01; // Moon Pearl
    await h.advance(1000);
    expect(board().items.moonpearl).toBe(true);
    // Not a step of the player's history
    expect(board().past).toEqual([]);
  });

  it("syncs the board to the game on the player's word", async () => {
    const h = harness();
    expect(syncFromGame()).toBeNull();
    await act(() => connectAutotrack());
    await h.advance(0);
    act(() => board().handleItemClick("sword"));

    let changed: number | null = null;
    act(() => {
      changed = syncFromGame();
    });

    expect(changed).toBe(1);
    expect(board().items.sword).toBe(2);
    act(() => stopAutotrack());
    expect(syncFromGame()).toBeNull();
  });

  it("lays nothing a stopped session read", async () => {
    const h = harness();
    await act(() => connectAutotrack());
    await h.advance(0);
    act(() => stopAutotrack());
    act(() => useGameStore.setState(useGameStore.getInitialState(), true));

    h.memory[SAVE(0x357)] = 0x01;
    await h.advance(2000);

    expect(board().items.hookshot).toBe(false);
  });
});

describe("following the seed's run type", () => {
  const game = board;
  /** What the last reading's seed says of the board's run type. */
  const seedCheck = () => {
    const reading = useAutotrackStore.getState().reading;
    return reading && checkSeed(reading.seed, game());
  };

  /** A keysanity seed of its own name: a page switches to a seed once. */
  const keysanitySeed = (name: string, race = false) => {
    const h = harness({ name, race });
    writeSeedSettings(h.memory, { dungeonItems: "full" });
    return h;
  };

  it("switches a fresh board to the seed's run type, and says so", async () => {
    const h = keysanitySeed("FRESH");
    await act(() => connectAutotrack());
    await h.advance(0);

    expect(game().presetId).toBe("keysanity");
    expect(game().items.hookshot).toBe(true);
    expect(useAutotrackStore.getState().news?.text).toBe(
      "This seed is Keysanity (Open, Ganon, 7/7): the tracker switched to it.",
    );
    expect(seedCheck()?.kind).toBe("same");
  });

  it("asks before switching a board with a run on it, as one undo step", async () => {
    const h = keysanitySeed("ASKED");
    act(() => game().handleItemClick("flute"));
    await act(() => connectAutotrack());
    await h.advance(0);
    expect(game().presetId).toBe("open");
    expect(seedCheck()).toMatchObject({
      kind: "differs",
      presetId: "keysanity",
      seed: "ASKED",
    });

    act(() => switchToSeed());

    expect(game()).toMatchObject({ presetId: "keysanity" });
    expect(game().items).toMatchObject({ flute: false, hookshot: true });
    expect(seedCheck()?.kind).toBe("same");
    act(() => game().undo());
    expect(game().presetId).toBe("open");
    expect(game().items).toMatchObject({ flute: true, hookshot: true });
  });

  it("keeps the player's run type for a seed, at the next visit too", async () => {
    const h = keysanitySeed("KEPT");
    act(() => game().handleItemClick("flute"));
    await act(() => connectAutotrack());
    await h.advance(0);

    act(() => keepRunType());
    expect(
      JSON.parse(localStorage.getItem("alltp-tracker-autotrack") ?? "{}").state,
    ).toEqual({ connectOnStart: true, keptSeed: "KEPT" });

    // A new game, fresh: still the player's run type for this seed
    act(() => game().reset());
    h.memory[SAVE(0x357)] = 0x01; // the game moves on: a new reading
    await h.advance(1000);
    expect(game().items.moonpearl).toBe(true);
    expect(game().presetId).toBe("open");
  });

  it("switches a seed once per page: the player's own choice then stands", async () => {
    const h = keysanitySeed("ONCE");
    await act(() => connectAutotrack());
    await h.advance(0);
    expect(game().presetId).toBe("keysanity");

    act(() => game().applyPreset("open"));
    h.memory[SAVE(0x357)] = 0x01; // the game moves on: a new reading
    await h.advance(1000);
    expect(game().items.moonpearl).toBe(true);

    expect(game().presetId).toBe("open");
    expect(seedCheck()?.kind).toBe("differs");
  });

  it("reads no settings in Race Mode: the run type stays the player's", async () => {
    const h = keysanitySeed("RACED", true);
    await act(() => connectAutotrack());
    await h.advance(0);

    expect(game().presetId).toBe("open");
    expect(seedCheck()).toEqual({ kind: "unread", why: "race-mode" });
  });
});
