import {
  compile,
  type DungeonId,
  filler,
  MARKERS,
  solveWithKeys,
  type TrickId,
  toState,
} from "@alltp/pack-alttpr";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  items as freshItems,
  type ItemState,
  itemsMax,
} from "@/games/alttpr/data/items";
import { getPreset } from "@/games/alttpr/data/presets";
import { analyzeRun, goModeStatusOf } from "@/games/alttpr/logic/missing";
import { KEY_DUNGEONS, packSettings } from "@/games/alttpr/logic/settings";
import {
  bossStateOf,
  crossedSolverLoaded,
  dungeonCount,
  dungeonStateOf,
  locationName,
  locationStateOf,
  locationStatus,
  markerById,
  markerDetail,
  markerStateOf,
  setCrossedSolver,
  setDoorSolver,
  solutionOf,
  trackerInput,
  trickSolutionOf,
  tricksShown,
  useBossStatus,
  useDungeonStatus,
  useLocationStatus,
  useMarkerStatus,
  warmTricks,
} from "@/games/alttpr/logic/solution";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

const store = () => useGameStore.getState();

/** Set items as the grid would leave them. */
const give = (items: Record<string, number | boolean>) =>
  act(() =>
    useGameStore.setState((state) => ({ items: { ...state.items, ...items } })),
  );

beforeEach(() => {
  act(() => useGameStore.setState(useGameStore.getInitialState(), true));
});

describe("trackerInput", () => {
  it("reads a fresh run as nothing held, Zelda rescued", () => {
    expect(trackerInput(store())).toEqual({
      beaten: { "hyrule-castle": true },
      // None of the 20 a fresh board asks for
      goalPieces: { found: 0, required: 20 },
      items: {},
      keys: Object.fromEntries(KEY_DUNGEONS.map((id) => [id, 0])),
      medallions: { mire: "unknown", turtleRock: "unknown" },
      prizes: {},
      // No hearts set, and no cell for the escape's bombs
      unknown: { bombs: true, bombUpgrade: true, health: true },
    });
  });

  it("reads the grid's items, bosses, prizes and pads as the pack's", () => {
    give({
      agahnim: 1,
      agahnim2: 1,
      boss0: 2,
      bow: 3,
      flute: true,
      reward0: 1,
      reward5: 4,
      tunic: 3,
    });
    act(() => {
      store().handleMedallionChange(8, 2);
      store().handleSmallKeyClick(3);
    });

    const input = trackerInput(store());

    expect(input.items).toEqual({
      armor: 2,
      bow: 1,
      flute: 1,
      silverArrowUpgrade: 1,
    });
    expect(input.beaten).toEqual({
      "castle-tower": true,
      "eastern-palace": true,
      "ganons-tower": true,
      "hyrule-castle": true,
    });
    expect(input.prizes).toEqual({
      "eastern-palace": "greenPendant",
      "skull-woods": "redCrystal",
    });
    expect(input.medallions).toEqual({ mire: "ether", turtleRock: "unknown" });
    expect(input.keys?.["palace-of-darkness"]).toBe(1);
  });

  it("leaves the dungeon counters out, however high keysanity takes them", () => {
    act(() => store().applyPreset("keysanity"));

    expect(store().items.chest3).toBe(14);
    expect(trackerInput(store()).items).toEqual({});
  });
});

describe("solutionOf", () => {
  it("is the pack's key model over the run's state", () => {
    give({ boots: true, glove: 2, lantern: true, moonpearl: true });
    const settings = packSettings(store().settings);

    const expected = solveWithKeys(
      filler(compile(settings), settings),
      toState(trackerInput(store()), settings),
    ).locations();

    expect(solutionOf(store()).tris).toEqual(expected);
    expect(Object.keys(expected).length).toBeGreaterThan(200);
  });

  it("solves once per change of the run, never for a checked location", () => {
    const before = solutionOf(store());

    act(() => store().toggleChecks(["links-house"]));
    act(() => store().setMapLayout("stacked"));
    expect(solutionOf(store())).toBe(before);

    give({ hammer: true });
    const after = solutionOf(store());
    expect(after).not.toBe(before);
    expect(solutionOf(store())).toBe(after);
  });

  it("solves a Standard run in the Standard world", () => {
    act(() => store().applyPreset("standard"));

    expect(solutionOf(store()).settings.standardMode).toBe(true);
  });

  it("solves again once an event is checked: the Bomb Merchant sells the bomb", () => {
    act(() => store().applyPreset("inverted"));
    give({ hammer: true, mirror: true, sword: 1 });
    const before = solutionOf(store());
    expect(before.settings.invertedMode).toBe(true);
    expect(before.tris["pyramid-fairy/sword"]).toBe("no");

    act(() => store().toggleChecks(["bomb-merchant"]));
    const bought = solutionOf(store());
    expect(bought).not.toBe(before);
    expect(trackerInput(store()).checked).toEqual({ "bomb-merchant": true });
    expect(bought.tris["pyramid-fairy/sword"]).toBe("yes");

    act(() => store().toggleChecks(["links-house"]));
    expect(solutionOf(store())).toBe(bought);
  });
});

describe("a run with shuffled entrances", () => {
  it("is maybe until its solver loads, then in logic by the doors noted", async () => {
    act(() => store().applyPreset("crosskeys"));
    const blinds = "blinds-hideout/top";
    expect(crossedSolverLoaded()).toBe(false);
    expect(solutionOf(store())).toMatchObject({ modelled: false });
    expect(solutionOf(store()).tris[blinds]).toBe("maybe");

    const { solver } = await import("@/games/alttpr/logic/crossed");
    act(() => setCrossedSolver(solver));
    // Behind a door not noted: out of logic
    expect(solutionOf(store())).toMatchObject({ modelled: true });
    expect(solutionOf(store()).tris[blinds]).toBe("no");
    // Outdoors, from Link's House
    expect(solutionOf(store()).tris.mushroom).toBe("yes");

    act(() => store().noteEntrance("kakariko-shop", "blinds-hideout"));
    expect(solutionOf(store()).tris[blinds]).toBe("yes");
    // The same entrances, the same solution
    expect(solutionOf(store())).toBe(solutionOf(store()));
  });

  it("reads a glitched seed or a No Logic one as NoGlitches, without the boots", async () => {
    // vt fills any shuffled seed as noglitches, no boots (EntranceRandomizer.php:84-91,
    // Randomizer.php:122-131): a rock only the boots break stays out of logic
    const { solver } = await import("@/games/alttpr/logic/crossed");
    act(() => {
      setCrossedSolver(solver);
      store().applyPreset("crosskeys");
      store().noteEntrance("bonk-rock-cave", "bonk-rock-cave");
    });
    const rocks = "pegasus-rocks";
    expect(solutionOf(store()).tris[rocks]).toBe("no");
    const plain = solutionOf(store());
    for (const glitches of [
      "overworld_glitches",
      "major_glitches",
      "no_logic",
    ] as const) {
      act(() => store().updateSettings({ glitches }));
      expect(solutionOf(store()), glitches).toMatchObject({ modelled: true });
      expect(solutionOf(store()).tris[rocks], glitches).toBe("no");
      expect(solutionOf(store()).tris, glitches).toEqual(plain.tris);
    }
    act(() => store().setItem("boots", true));
    expect(solutionOf(store()).tris[rocks]).toBe("yes");
  });

  it("goes by the entrance randomizer's world for the go mode", async () => {
    const { solver } = await import("@/games/alttpr/logic/crossed");
    act(() => {
      setCrossedSolver(solver);
      store().applyPreset("crosskeys");
      useGameStore.setState({
        items: Object.fromEntries(
          Object.entries(freshItems).map(([id, value]) => [
            id,
            typeof value === "boolean" ? true : itemsMax[id],
          ]),
        ) as unknown as ItemState,
      });
    });
    // Everything held, but Ganon's Tower's door not noted
    expect(goModeStatusOf(store())).toMatchObject({ tri: "no" });
    // Nothing to get brings it: only a door noted would
    expect(analyzeRun(solutionOf(store()), store().settings).goMode).toEqual({
      kind: "door",
    });
  });

  it("buys a Retro run's arrows in the shops it found", async () => {
    const { solver } = await import("@/games/alttpr/logic/crossed");
    act(() => {
      setCrossedSolver(solver);
      store().applyPreset("crosskeys");
      useGameStore.setState({
        settings: { ...store().settings, mode: "retro" },
      });
      useGameStore.setState({
        items: Object.fromEntries(
          Object.entries(freshItems).map(([id, value]) => [
            id,
            id === "shoparrow" || id === "shopkey"
              ? 0
              : typeof value === "boolean"
                ? true
                : itemsMax[id],
          ]),
        ) as unknown as ItemState,
      });
      store().noteEntrance("eastern-palace", "eastern-palace-exit");
    });
    const boss = "eastern-palace/boss";
    // No shop found nor reached: the bow shoots nothing
    expect(solutionOf(store()).tris[boss]).toBe("no");
    act(() => store().setItem("shoparrow", 1));
    expect(solutionOf(store()).tris[boss]).toBe("yes");
  });

  it("reads the keys kept in their dungeons by that world's own key model", async () => {
    const { solver } = await import("@/games/alttpr/logic/crossed");
    act(() => {
      setCrossedSolver(solver);
      store().applyPreset("crosskeys");
      store().updateSettings({ dungeonItems: "standard" });
      useGameStore.setState({
        items: Object.fromEntries(
          Object.entries(freshItems).map(([id, value]) => [
            id,
            typeof value === "boolean"
              ? true
              : // Its big keys are no more marked than its small keys
                id.startsWith("bigkey")
                ? 0
                : itemsMax[id],
          ]),
        ) as unknown as ItemState,
      });
      store().noteEntrance(
        "hyrule-castle-entrance-south",
        "hyrule-castle-exit-south",
      );
    });
    const room = "sewers/secret-room/left";
    // vt's world holds Eastern Palace's big key surely in hand, its spots
    // all reached there; behind no door noted, the run's world does not
    const { crossed, keyed } = solutionOf(store());
    expect(keyed.state.bigKeyP1).toBe(1);
    expect(crossed?.state.bigKeyP1 ?? 0).toBe(0);
    // The castle's key may sit in the sewers' secret room, which the
    // grave's hole, not noted, may drop the fill's state into without it
    expect(crossed?.state.keyH2 ?? 0).toBe(0);
    expect(solutionOf(store()).tris[room]).toBe("maybe");
    // The hole noted: every spot of the key is the player's as the fill's
    act(() => store().noteEntrance("sanctuary-grave", "sewer-drop"));
    expect(solutionOf(store()).crossed?.state.keyH2).toBe(1);
    expect(solutionOf(store()).tris[room]).toBe("yes");
  });

  it("reads a shuffled boss as any its slot may hold", async () => {
    const { solver } = await import("@/games/alttpr/logic/crossed");
    act(() => {
      setCrossedSolver(solver);
      store().applyPreset("crosskeys");
      useGameStore.setState({
        items: Object.fromEntries(
          Object.entries(freshItems).map(([id, value]) => [
            id,
            typeof value === "boolean"
              ? id !== "icerod"
              : // Every boss left unknown (its cell's top is a boss known)
                id.startsWith("knownboss")
                ? 0
                : itemsMax[id],
          ]),
        ) as unknown as ItemState,
      });
      store().noteEntrance("eastern-palace", "eastern-palace-exit");
    });
    const boss = "eastern-palace/boss";
    // The Armos Knights need no ice rod
    expect(solutionOf(store()).tris[boss]).toBe("yes");
    // Trinexx, whom the slot may hold, does
    act(() => store().updateSettings({ bossShuffle: "full" }));
    expect(solutionOf(store()).tris[boss]).toBe("maybe");
    // The boss marked (knownboss0, Eastern Palace's): the Armos Knights
    // again (1), or Trinexx (10), whom no ice rod beats
    act(() =>
      useGameStore.setState((s) => ({ items: { ...s.items, knownboss0: 1 } })),
    );
    expect(solutionOf(store()).tris[boss]).toBe("yes");
    act(() =>
      useGameStore.setState((s) => ({ items: { ...s.items, knownboss0: 10 } })),
    );
    expect(solutionOf(store()).tris[boss]).toBe("no");
  });
});

describe("a Door Randomizer run", () => {
  const CASTLE_TOWER = KEY_DUNGEONS.indexOf("castle-tower");

  it("is maybe until DR's world loads, then solved in it", async () => {
    act(() => {
      store().applyPreset("door-randomizer");
      store().updateDoorSettings({ bombBag: false });
    });
    expect(solutionOf(store())).toMatchObject({ modelled: false });
    expect(solutionOf(store()).tris.mushroom).toBe("maybe");

    const { solver } = await import("@/games/alttpr/logic/drSolver");
    act(() => setDoorSolver(solver));
    const solution = solutionOf(store());
    expect(solution).toMatchObject({ modelled: true });
    expect(solution.door).toBeDefined();
    expect(solution.tris.mushroom).toBe("yes");
    // Every check of the map is one of DR's world
    const missing = MARKERS.flatMap((marker) => marker.locations).filter(
      (id) => solution.tris[id] === undefined,
    );
    expect(missing).toEqual([]);
    // No tricks or margin world for it
    expect(
      tricksShown({
        ...store(),
        tricks: { enabled: true, techniques: ["fakeFlipper"] },
      }),
    ).toBe(false);
  });

  it("reads the keys recorded in their dungeons: below DR's number maybe", async () => {
    const { solver } = await import("@/games/alttpr/logic/drSolver");
    act(() => {
      setDoorSolver(solver);
      store().applyPreset("door-randomizer");
      store().updateDoorSettings({ bombBag: false });
    });
    // Agahnim's Tower's dark maze: one key past its first door
    // (validate_vanilla_key_logic, KeyDoorShuffle.py:2079-2083)
    give({ agahnim: 0, cape: true, lantern: true, sword: 1 });
    const maze = "castle-tower/dark-maze";
    expect(solutionOf(store()).tris[maze]).toBe("maybe");
    act(() => store().setSmallKeys(CASTLE_TOWER, 1));
    expect(solutionOf(store()).tris[maze]).toBe("yes");
  });
});

describe("locationStatus", () => {
  // [tris, visibles, status]: available > possible > seen > unavailable
  it.each([
    [["yes"], ["yes"], "available"],
    [["yes", "yes"], ["yes", "yes"], "available"],
    [["yes", "no"], ["yes", "yes"], "possible"],
    [["yes", "no"], ["yes", "no"], "possible"],
    [["maybe"], ["maybe"], "possible"],
    [["maybe", "no"], ["maybe", "yes"], "possible"],
    [["no"], ["yes"], "seen"],
    [["no"], ["maybe"], "seen"],
    [["no", "no"], ["no", "yes"], "seen"],
    [["no"], ["no"], "unavailable"],
    [["no", "no"], ["no", "no"], "unavailable"],
    [[], [], "unavailable"],
  ] as const)("reads tris %j, seen %j, as %s", (tris, visibles, status) => {
    expect(locationStatus(tris, visibles)).toBe(status);
  });
});

describe("what a marker shows", () => {
  const show = (id: string) => markerStateOf(markerById(id), store());

  it("shows a location seen from afar, out of logic, as seen", () => {
    // Seen from the shore from the start: Lake Hylia Island, Desert Ledge
    expect(show("lake-hylia-island")).toBe("seen");
    expect(show("desert-ledge")).toBe("seen");

    // The Book reads the Pedestal; the three pendants take the sword
    expect(show("master-sword-pedestal")).toBe("unavailable");
    give({ book: true });
    expect(show("master-sword-pedestal")).toBe("seen");
    expect(markerDetail(markerById("master-sword-pedestal"), store())).toEqual([
      "seen",
    ]);
    give({ boss0: 2, boss1: 2, boss2: 2, reward0: 1, reward1: 2, reward2: 2 });
    expect(show("master-sword-pedestal")).toBe("available");
    act(() => store().toggleChecks(["master-sword-pedestal"]));
    expect(show("master-sword-pedestal")).toBe("opened");
    // The Book opens Desert Palace, whose ledge is now in logic
    expect(show("desert-ledge")).toBe("available");
  });

  it("reads a location marker from the locations it still stands for", () => {
    // King's Tomb wants the boots and a way to lift its gravestone
    expect(show("kings-tomb")).toBe("unavailable");
    expect(show("links-house")).toBe("available");

    give({ boots: true, glove: 2 });
    expect(show("kings-tomb")).toBe("available");
  });

  it("shows a cave the old map split in two as one marker, only some of it in logic", () => {
    // Boots and a way to the Dark World's Death Mountain, no hookshot: the
    // boots cross to the bottom right chest alone
    give({
      boots: true,
      flute: true,
      glove: 2,
      hammer: true,
      mirror: true,
      moonpearl: true,
    });
    const cave = markerById("hookshot-cave");
    expect(cave.locations).toHaveLength(4);
    expect(show("hookshot-cave")).toBe("possible");
    expect(markerDetail(cave, store())).toEqual([
      "unavailable",
      "unavailable",
      "unavailable",
      "available",
    ]);
    expect(() => markerById("hookshot-cave-bottom-right")).toThrow(RangeError);

    give({ hookshot: true });
    expect(show("hookshot-cave")).toBe("available");
  });

  it("shows Sahasrahla's Hut as only some until the pendant he wants is held", () => {
    const hut = markerById("sahasrahlas-hut");
    expect(hut.locations).toContain("sahasrahla");
    expect(show("sahasrahlas-hut")).toBe("possible");
    expect(markerDetail(hut, store())).toEqual([
      "available",
      "available",
      "available",
      "unavailable",
    ]);
    expect(() => markerById("sahasrahla")).toThrow(RangeError);

    // Checking the chests leaves the gift to take
    act(() => store().toggleChecks(hut.locations.slice(0, 3)));
    expect(show("sahasrahlas-hut")).toBe("unavailable");
  });

  it("is done once every location it stands for is checked", () => {
    act(() => store().toggleChecks(["mire-shed/left"]));
    expect(show("mire-shed")).toBe("unavailable");

    act(() => store().toggleChecks(["mire-shed/right"]));
    expect(show("mire-shed")).toBe("opened");
  });

  it("names every world's locations, the Inverted Bomb Merchant too", () => {
    expect(locationName("kings-tomb")).toBe("King's Tomb");
    expect(locationName("bomb-merchant")).toBe("Bomb Merchant");
  });

  it("throws for a marker the map does not have", () => {
    expect(() => markerById("nowhere")).toThrow(RangeError);
  });
});

describe("what a dungeon shows", () => {
  it("counts by the pigeonhole rule, not by reachable locations", () => {
    // Eastern Palace with nothing: three chests in logic, its big key
    // chest (dark), its big chest and its boss not; three items left may
    // all sit in those three
    expect(dungeonStateOf("eastern-palace", store())).toBe("possible");

    give({ bow: 2, lantern: true });
    expect(dungeonStateOf("eastern-palace", store())).toBe("available");

    give({ chest0: 0 });
    expect(dungeonStateOf("eastern-palace", store())).toBe("opened");
  });

  it("shows Castle Tower done outside keysanity, where it holds no item", () => {
    expect(dungeonStateOf("castle-tower", store())).toBe("opened");

    act(() => store().applyPreset("keysanity"));
    expect(dungeonStateOf("castle-tower", store())).not.toBe("opened");
  });

  it("reads the castle dungeons' keys from their key cells in keysanity", () => {
    act(() => store().applyPreset("keysanity"));
    give({ cape: true, lantern: true, sword: 1 });
    // Castle Tower's dark maze wants a key, Agahnim both
    expect(solutionOf(store()).tris["castle-tower/dark-maze"]).toBe("no");

    act(() =>
      useGameStore.setState({
        smallKeys: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 4],
      }),
    );
    give({ bigkey12: 1, compass12: 1, map10: 1, map12: 1 });

    expect(solutionOf(store()).tris["castle-tower/dark-maze"]).toBe("yes");
    expect(solutionOf(store()).tris.agahnim).toBe("yes");
    const input = trackerInput(store());
    expect(input.keys).toMatchObject({
      "castle-tower": 2,
      "ganons-tower": 4,
      "hyrule-castle": 1,
    });
    expect(input.items).toMatchObject({
      bigKeyA2: 1,
      compassA2: 1,
      mapA2: 1,
      mapH2: 1,
    });
  });

  it("shows Ganon's Tower out of logic without the crystals", () => {
    expect(dungeonStateOf("ganons-tower", store())).toBe("unavailable");
  });

  it("counts Ganon's Tower down on its own cell, done at 0", () => {
    expect(dungeonCount("ganons-tower", store())).toBe(20);
    expect(dungeonCount("castle-tower", store())).toBeUndefined();
    give({ chest12: 0 });
    expect(dungeonStateOf("ganons-tower", store())).toBe("opened");
  });

  it("wants a dungeon's map and compass for its boss in keysanity", () => {
    act(() => store().applyPreset("keysanity"));
    give({ bigkey0: 1, bow: 2, lantern: true });
    // Wild maps and compasses: the boss may hold them, so it is a maybe
    expect(bossStateOf("eastern-palace", store())).toBe("possible");
    expect(trackerInput(store()).items).toMatchObject({ bigKeyP1: 1 });

    give({ map0: 1 });
    expect(bossStateOf("eastern-palace", store())).toBe("possible");
    give({ compass0: 1 });
    expect(trackerInput(store()).items).toMatchObject({
      compassP1: 1,
      mapP1: 1,
    });
    expect(bossStateOf("eastern-palace", store())).toBe("available");
  });

  it("shows a boss beaten as done, and else whether its rule holds", () => {
    expect(bossStateOf("eastern-palace", store())).toBe("unavailable");
    give({ bow: 2, lantern: true });
    expect(bossStateOf("eastern-palace", store())).toBe("available");
    give({ boss0: 2 });
    expect(bossStateOf("eastern-palace", store())).toBe("opened");

    expect(bossStateOf("castle-tower", store())).toBe("unavailable");
    give({ agahnim: 1, agahnim2: 1 });
    expect(bossStateOf("castle-tower", store())).toBe("opened");
    expect(bossStateOf("ganons-tower", store())).toBe("opened");
  });
});

describe("the hooks", () => {
  const MarkerProbe = ({
    id,
    note,
  }: {
    id: string;
    note: (key: string, value: string) => void;
  }) => {
    note(`marker:${id}`, useMarkerStatus(id));
    return null;
  };
  const BossProbe = ({
    id,
    note,
  }: {
    id: DungeonId;
    note: (key: string, value: string) => void;
  }) => {
    note(`boss:${id}`, useBossStatus(id));
    return null;
  };
  const CounterProbe = ({
    note,
  }: {
    note: (key: string, value: string) => void;
  }) => {
    note("counter:eastern-palace", useDungeonStatus("eastern-palace"));
    return null;
  };
  const LocationProbe = ({
    note,
  }: {
    note: (key: string, value: string) => void;
  }) => {
    note("location:kings-tomb", useLocationStatus("kings-tomb"));
    return null;
  };
  /** Every probe, side by side: the root reads no hook, so never renders again. */
  const Probes = ({ note }: { note: (key: string, value: string) => void }) => {
    return (
      <>
        <CounterProbe note={note} />
        <LocationProbe note={note} />
        {MARKERS.map((marker) => (
          <MarkerProbe id={marker.id} key={marker.id} note={note} />
        ))}
        {MARKERS.flatMap((marker) =>
          marker.dungeon
            ? [
                <BossProbe
                  id={marker.dungeon}
                  key={marker.dungeon}
                  note={note}
                />,
              ]
            : [],
        )}
      </>
    );
  };

  /** Render one probe per hook use, each counting its renders. */
  const renderProbes = () => {
    const renders = new Map<string, number>();
    const shown = new Map<string, string>();
    render(
      <Probes
        note={(key, value) => {
          renders.set(key, (renders.get(key) ?? 0) + 1);
          shown.set(key, value);
        }}
      />,
    );
    return { renders, shown };
  };

  /** The probes that rendered again since `before`. */
  const rerendered = (
    renders: Map<string, number>,
    before: Map<string, number>,
  ) =>
    [...renders]
      .filter(([key, count]) => count > (before.get(key) ?? 0))
      .map(([key]) => key)
      .sort();

  it("re-render only what a new item changes", () => {
    const { renders, shown } = renderProbes();
    const rendered = new Map(renders);
    const before = new Map(shown);

    give({ boots: true, glove: 2 });

    const changed = [...shown]
      .filter(([key, value]) => before.get(key) !== value)
      .map(([key]) => key)
      .sort();
    expect(changed).toContain("marker:kings-tomb");
    expect(changed).toContain("location:kings-tomb");
    expect(rerendered(renders, rendered)).toEqual(changed);
    expect(changed.length).toBeLessThan(renders.size / 2);
  });

  it("re-render only the marker a check changes, solving nothing", () => {
    const { renders } = renderProbes();
    const rendered = new Map(renders);
    const solution = solutionOf(store());

    act(() => store().toggleChecks(markerById("kakariko-well").locations));

    expect(rerendered(renders, rendered)).toEqual(["marker:kakariko-well"]);
    expect(solutionOf(store())).toBe(solution);
  });
});

describe("locationStatus with tricks", () => {
  // [tris, visibles, tricks, status]: available > possible > trick > seen
  it.each([
    [["no"], ["no"], ["yes"], "trick"],
    [["no"], ["no"], ["maybe"], "trick"],
    [["no", "no"], ["no", "no"], ["no", "yes"], "trick"],
    [["no"], ["yes"], ["yes"], "trick"],
    [["no"], ["yes"], ["no"], "seen"],
    [["no"], ["no"], ["no"], "unavailable"],
    [["yes", "no"], ["yes", "no"], ["yes", "yes"], "possible"],
    [["yes"], ["yes"], ["yes"], "available"],
    [["maybe"], ["maybe"], ["yes"], "possible"],
  ] as const)(
    "reads tris %j, seen %j, with tricks %j, as %s",
    (tris, visibles, tricks, status) => {
      expect(locationStatus(tris, visibles, tricks)).toBe(status);
    },
  );
});

describe("the tricks the player knows", () => {
  const learn = (...techniques: TrickId[]) =>
    act(() => store().setTricks({ enabled: true, techniques }));
  const show = (id: string) => markerStateOf(markerById(id), store());

  it("solve nothing while the preference is off or lists none", () => {
    expect(trickSolutionOf(store())).toBeUndefined();
    act(() => store().setTricks({ enabled: false, techniques: ["darkRooms"] }));
    expect(trickSolutionOf(store())).toBeUndefined();
    expect(show("sewers-secret-room")).toBe("unavailable");
    learn();
    expect(trickSolutionOf(store())).toBeUndefined();
    expect(tricksShown(store())).toBe(false);
  });

  it("mark what a trick opens, and only for the trick known", () => {
    // No Lamp, no Flippers, Zelda rescued: the dark room of the Sewers, and
    // the Hobo's and King Zora's waters
    expect(show("sewers-secret-room")).toBe("unavailable");
    expect(show("hobo")).toBe("unavailable");

    learn("darkRooms");
    expect(show("sewers-secret-room")).toBe("trick");
    expect(show("hobo")).toBe("unavailable");

    learn("fakeFlipper");
    expect(show("sewers-secret-room")).toBe("unavailable");
    expect(show("hobo")).toBe("trick");
    expect(show("king-zora")).toBe("trick");
    expect(locationStateOf("hobo", store())).toBe("trick");
  });

  it("leave a location in logic, or done, as it is", () => {
    learn("darkRooms", "fakeFlipper", "waterWalk", "superBunny");
    give({ flippers: true });
    expect(show("hobo")).toBe("available");
    act(() => store().toggleChecks(["hobo"]));
    expect(show("hobo")).toBe("opened");
  });

  it("put a dungeon's square and boss on the trick that opens them", () => {
    give({
      boots: true,
      bow: 3,
      firerod: true,
      glove: 2,
      hammer: true,
      hookshot: true,
      icerod: true,
      mirror: true,
      moonpearl: true,
      somaria: true,
      sword: 3,
    });
    expect(dungeonStateOf("ice-palace", store())).toBe("unavailable");
    expect(bossStateOf("ice-palace", store())).toBe("unavailable");
    expect(bossStateOf("palace-of-darkness", store())).toBe("unavailable");
    expect(bossStateOf("castle-tower", store())).toBe("unavailable");

    learn("fakeFlipper");
    expect(dungeonStateOf("ice-palace", store())).toBe("trick");
    expect(bossStateOf("ice-palace", store())).toBe("trick");
    expect(bossStateOf("palace-of-darkness", store())).toBe("unavailable");

    learn("darkRooms");
    expect(dungeonStateOf("ice-palace", store())).toBe("unavailable");
    expect(bossStateOf("palace-of-darkness", store())).toBe("trick");
    expect(bossStateOf("castle-tower", store())).toBe("trick");
  });

  it("are solved once per run and per list, never by a click", () => {
    learn("darkRooms");
    const first = trickSolutionOf(store());
    expect(first).toBeDefined();
    expect(trickSolutionOf(store())).toBe(first);

    act(() => store().toggleChecks(["hobo"]));
    expect(trickSolutionOf(store())).toBe(first);

    learn("darkRooms", "waterWalk");
    expect(trickSolutionOf(store())).not.toBe(first);

    const second = trickSolutionOf(store());
    give({ boots: true });
    expect(trickSolutionOf(store())).not.toBe(second);
  });

  it("are not offered where the run has no tricks world", () => {
    act(() => {
      store().applyPreset("crosskeys");
      store().setTricks({ enabled: true, techniques: ["darkRooms"] });
    });
    expect(tricksShown(store())).toBe(false);
    expect(trickSolutionOf(store())).toBeUndefined();
  });

  it("warm the tricks world ahead without turning anything on", () => {
    const before = solutionOf(store());
    warmTricks(store().settings);
    expect(solutionOf(store())).toBe(before);
    expect(trickSolutionOf(store())).toBeUndefined();
    // A run with no tricks world has nothing to warm
    expect(() => warmTricks(getPreset("crosskeys").settings)).not.toThrow();
    learn("darkRooms");
    expect(show("sewers-secret-room")).toBe("trick");
  });

  it("move no in-logic answer: the solution never reads them", () => {
    const off = solutionOf(store());
    learn("darkRooms", "fakeFlipper", "waterWalk");
    expect(solutionOf(store())).toBe(off);
  });
});
