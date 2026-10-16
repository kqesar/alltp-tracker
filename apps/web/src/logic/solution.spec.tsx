import {
  compile,
  type DungeonId,
  filler,
  LEGACY_DUNGEONS,
  MARKERS,
  solveWithKeys,
  toState,
} from "@alltp/pack-alttpr";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { packSettings } from "@/logic/settings";
import {
  bossStateOf,
  dungeonStateOf,
  markerById,
  markerStateOf,
  solutionOf,
  trackerInput,
  useBossStatus,
  useDungeonStatus,
  useLocationStatus,
  useMarkerStatus,
} from "@/logic/solution";
import { useGameStore } from "@/stores/gameStore";

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
      items: {},
      keys: Object.fromEntries(LEGACY_DUNGEONS.map((id) => [id, 0])),
      medallions: { mire: "unknown", turtleRock: "unknown" },
      prizes: {},
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
});

describe("what a marker shows", () => {
  const show = (id: string) => markerStateOf(markerById(id), store());

  it("reads a location marker from the locations it still stands for", () => {
    // King's Tomb wants the boots and a way to lift its gravestone
    expect(show("kings-tomb")).toBe("unavailable");
    expect(show("links-house")).toBe("available");

    give({ boots: true, glove: 2 });
    expect(show("kings-tomb")).toBe("available");
  });

  it("is done once every location it stands for is checked", () => {
    act(() => store().toggleChecks(["mire-shed/left"]));
    expect(show("mire-shed")).toBe("unavailable");

    act(() => store().toggleChecks(["mire-shed/right"]));
    expect(show("mire-shed")).toBe("opened");
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

  it("shows Ganon's Tower out of logic without the crystals", () => {
    expect(dungeonStateOf("ganons-tower", store())).toBe("unavailable");
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
