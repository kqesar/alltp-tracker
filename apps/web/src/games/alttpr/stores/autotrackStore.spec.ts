import { parseUserAgent } from "@alltp/autotrack";
import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeVisibility, GRANTED, ManualClock } from "@/autotrack/fixtures";
import { SAVE, seedMemory } from "@/games/alttpr/autotrack/fixtures";
import { checkSeed } from "@/games/alttpr/autotrack/seed";
import { forgetSeedFiles } from "@/games/alttpr/autotrack/seedFile";
import {
  connectAutotrack,
  keepRunType,
  setAutotrackOptions,
  stopAutotrack,
  switchToSeed,
  syncFromGame,
  useAutotrackStore,
} from "@/games/alttpr/stores/autotrackStore";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { MemoryTransport } from "../../../../../../packages/autotrack/test/memory-transport";
import openSeedFile from "../../../../../../packs/alttpr/test/seed-files/9MQ9gO1wMD.json";
import { writeSeedSettings } from "../../../../../../packs/alttpr/test/seed-rom";

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
  forgetSeedFiles();
  vi.unstubAllGlobals();
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

describe("Race Mode as the player sets it", () => {
  const reading = () => useAutotrackStore.getState().reading;

  it("holds Race Mode on over a seed without the race flag, saved", async () => {
    const h = harness();
    act(() => useAutotrackStore.getState().setRaceChoice("on"));
    await act(() => connectAutotrack());
    await h.advance(0);

    const { status } = useAutotrackStore.getState();
    expect(status.code === "connected" && status.race).toMatchObject({
      active: true,
      flag: "open",
      setting: "on",
    });
    // Decoded as on a race seed: no entrance, no settings, no ROM stats, no
    // check inside a dungeon
    expect(reading()).toMatchObject({ entrances: "race-mode", race: true });
    expect(reading()?.progress.romStats).toBe("race-mode");
    expect(reading()?.seed.mode).toEqual({ known: false, why: "race-mode" });
    expect(board().checked["links-house"]).toBe(true);
    expect(board().checked["eastern-palace/compass-chest"]).toBeUndefined();
    expect(
      JSON.parse(localStorage.getItem("alltp-tracker-autotrack") ?? "{}").state,
    ).toEqual({ connectOnStart: true, keptSeed: null, raceChoice: "on" });
  });

  it("follows a change while connected, decoding again at once", async () => {
    const h = harness();
    await act(() => connectAutotrack());
    await h.advance(0);
    expect(reading()?.race).toBe(false);

    act(() => useAutotrackStore.getState().setRaceChoice("on"));
    expect(reading()?.race).toBe(true);
    expect(reading()?.entrances).toBe("race-mode");

    act(() => useAutotrackStore.getState().setRaceChoice("auto"));
    expect(reading()?.race).toBe(false);
  });

  it("follows a change made in another tab of the tracker", async () => {
    const h = harness();
    await act(() => connectAutotrack());
    await h.advance(0);
    expect(reading()?.race).toBe(false);

    // Another tab saves its choice; this one hears of it through storage
    localStorage.setItem(
      "alltp-tracker-autotrack",
      JSON.stringify({
        state: { connectOnStart: true, keptSeed: null, raceChoice: "on" },
        version: 1,
      }),
    );
    await act(async () => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "alltp-tracker-autotrack",
          storageArea: localStorage,
        }),
      );
    });

    expect(useAutotrackStore.getState().raceChoice).toBe("on");
    expect(reading()?.race).toBe(true);
  });

  it("reads a saved Race Mode it does not know as the ROM's flag", async () => {
    localStorage.setItem(
      "alltp-tracker-autotrack",
      JSON.stringify({ state: { raceChoice: "off" }, version: 1 }),
    );
    await act(() => useAutotrackStore.persist.rehydrate());
    expect(useAutotrackStore.getState().raceChoice).toBe("auto");
  });
});

describe("following the seed's run type", () => {
  const game = board;
  /** What the last reading's seed says of the board's run type. */
  const reading = () => useAutotrackStore.getState().reading;
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
    ).toEqual({ connectOnStart: true, keptSeed: "KEPT", raceChoice: "auto" });

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

  describe("a seed's file on alttpr.com", () => {
    /** alttpr.com answering with a keysanity seed's file for `hash`. */
    const fileOnline = (hash: string, meta: Record<string, string> = {}) => {
      const file = {
        ...openSeedFile,
        hash,
        spoiler: {
          meta: {
            ...openSeedFile.spoiler.meta,
            dungeon_items: "full",
            ...meta,
          },
        },
      };
      const fetch = vi.fn(async () => new Response(JSON.stringify(file)));
      vi.stubGlobal("fetch", fetch);
      return fetch;
    };

    it("never asks for it in Race Mode: the run type stays the player's", async () => {
      // A Mystery race's file, which would switch a fresh board to Mystery
      const fetch = fileOnline("RaceFresh1", {
        spoilers: "mystery",
        tournament: "true",
      });
      const h = harness({ name: "RaceFresh1", race: true });
      await act(() => connectAutotrack());
      await h.advance(0);
      h.memory[SAVE(0x357)] = 0x01; // the game moves on: a new reading
      await h.advance(1000);

      expect(game().items.moonpearl).toBe(true);
      expect(fetch).not.toHaveBeenCalled();
      expect(useAutotrackStore.getState().seedFile).toBeNull();
      expect(seedCheck()).toEqual({ kind: "unread", why: "race-mode" });
      expect(game().presetId).toBe("open");
      expect(useAutotrackStore.getState().news).toBeNull();
    });

    it("lets a file asked before go once Race Mode is set always on", async () => {
      const fetch = fileOnline("NotRaced02", { item_placement: "basic" });
      const h = keysanitySeed("NotRaced02");
      await act(() => connectAutotrack());
      await h.advance(0);
      await vi.waitFor(() =>
        expect(reading()?.seed.itemPlacement).toMatchObject({
          value: "basic",
        }),
      );

      act(() => useAutotrackStore.getState().setRaceChoice("on"));

      expect(useAutotrackStore.getState().seedFile).toBeNull();
      expect(reading()?.seed.itemPlacement).not.toMatchObject({
        value: "basic",
      });
      h.memory[SAVE(0x357)] = 0x01; // the game moves on: a new reading
      await h.advance(1000);
      expect(reading()?.seed.itemPlacement).not.toMatchObject({
        value: "basic",
      });
      expect(fetch).toHaveBeenCalledOnce();
    });

    it("takes what a ROM never states from the file, then switches once", async () => {
      const fetch = fileOnline("NotRaced01", {
        item_functionality: "hard",
        item_placement: "basic",
        item_pool: "hard",
      });
      const h = keysanitySeed("NotRaced01");
      await act(() => connectAutotrack());
      await h.advance(0);

      await vi.waitFor(() => expect(game().presetId).toBe("keysanity"));
      expect(game().settings).toMatchObject({
        dungeonItems: "full",
        itemFunctionality: "hard",
        itemPlacement: "basic",
        itemPool: "hard",
      });
      expect(useAutotrackStore.getState().news?.text).toBe(
        "This seed is Keysanity (Open, Ganon, 7/7, Basic placement, Hard pool, Hard functionality): the tracker switched to it.",
      );
      // One switch, one undo step
      act(() => game().undo());
      expect(game().presetId).toBe("open");
      expect(fetch).toHaveBeenCalledOnce();
    });

    it("decides on the ROM's settings when alttpr.com cannot be reached", async () => {
      const fetch = vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      });
      vi.stubGlobal("fetch", fetch);
      const h = keysanitySeed("Offline001");
      await act(() => connectAutotrack());
      await h.advance(0);

      await vi.waitFor(() => expect(game().presetId).toBe("keysanity"));
      expect(game().settings.itemPlacement).toBe("advanced");
      expect(useAutotrackStore.getState().seedFile).toEqual({
        hash: "Offline001",
        result: "offline",
      });
    });
  });
});
