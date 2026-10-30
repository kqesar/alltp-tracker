import type { Settings, State } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import {
  type DrPoolSettings,
  type DrShuffle,
  drEntranceName,
  drEntrancePool,
  drTargetOf,
  vanillaEntrances,
} from "../door-rando/entrances";
import { solveFacts } from "../facts";
import { everything } from "../keys";
import { settingsFromUpstream } from "../settings";
import { notedConnections, vanillaConnections } from "./connections";
import {
  DR_DEFAULTS,
  type DrNotedEntrances,
  drLocationId,
  drWorld,
  everySide,
  probeId,
} from "./index";
import { portalsKnown } from "./key-analysis/dungeon";

type Mode = "open" | "standard" | "inverted";

const pool = (mode: Mode, more: Partial<DrPoolSettings> = {}) => ({
  dropShuffle: "none",
  enemyShuffle: false,
  mode,
  pottery: "none",
  shopsanity: false,
  shuffleLinks: false,
  shuffleTavern: false,
  ...more,
});

const settings = (mode: Mode, more: Settings = {}): Settings => ({
  ...DR_DEFAULTS,
  ...settingsFromUpstream(mode),
  drVersion: 158,
  ...more,
});

/** Every entrance a shuffle moves, noted where the vanilla world leads it. */
function vanillaNotes(
  shuffle: DrShuffle,
  mode: Mode,
  only?: (name: string) => boolean,
): Record<string, string> {
  const maps = vanillaEntrances(mode === "inverted");
  const notes: Record<string, string> = {};
  for (const entrance of drEntrancePool(shuffle, pool(mode)).entrances) {
    const name = drEntranceName(entrance.id) ?? "";
    if (only !== undefined && !only(name)) continue;
    const target = maps.twoWay.get(name) ?? maps.oneWay.get(name) ?? "";
    notes[entrance.id] = drTargetOf(target).id;
  }
  return notes;
}

const noted = (
  shuffle: DrShuffle,
  mode: Mode,
  notes: Record<string, string>,
): DrNotedEntrances => ({ noted: notes, pool: pool(mode), shuffle });

const SHUFFLES: readonly DrShuffle[] = [
  "simple",
  "restricted",
  "full",
  "crossed",
  "swapped",
  "lite",
  "lean",
  "dungeonssimple",
  "dungeonsfull",
];

describe("DR's world on noted entrances", () => {
  it("is the vanilla world once every entrance is noted where it was", () => {
    for (const shuffle of SHUFFLES)
      for (const mode of ["open", "standard", "inverted"] as const) {
        const built = notedConnections(
          mode,
          noted(shuffle, mode, vanillaNotes(shuffle, mode)),
          158,
        );
        expect(built.complete, `${shuffle} ${mode}`).toBe(true);
        expect(built.decoupled).toBe(false);
        // The Inverted world's lite and lean keep the save point's door
        // one way (do_vanilla_connect): its exit leads nowhere there
        const vanilla = new Map(vanillaConnections(mode, 158));
        if (mode === "inverted" && (shuffle === "lite" || shuffle === "lean"))
          vanilla.delete("Dark Sanctuary Hint Exit");
        expect(
          new Map([...built.connections].sort()),
          `${shuffle} ${mode}`,
        ).toEqual(new Map([...vanilla].sort()));
      }
  });

  it("leads an entrance not noted nowhere, and knows when all are", () => {
    const none = notedConnections("open", noted("crossed", "open", {}));
    expect(none.complete).toBe(false);
    expect(none.connections.has("Kakariko Shop")).toBe(false);
    expect(none.connections.has("Kakariko Well Drop")).toBe(false);
    // Kept vanilla: Link's House (no shufflelinks), the overworld
    expect(none.connections.get("Links House")).toBe("Links House");
    expect(none.connections.has("Kakariko Village NW")).toBe(
      vanillaConnections("open").has("Kakariko Village NW"),
    );
    // A note on an entrance the shuffle does not move, or of no target,
    // is passed over
    const stray = notedConnections(
      "open",
      noted("dungeonssimple", "open", {
        "eastern-palace": "no-such-target",
        "kakariko-shop": drTargetOf("Eastern Palace Exit").id,
      }),
    );
    expect(stray.connections.get("Kakariko Shop")).toBe("Kakariko Shop");
    expect(stray.connections.has("Eastern Palace")).toBe(false);
  });

  it("links a decoupled door one way, never its exit", () => {
    const notes = {
      "kakariko-shop": drTargetOf("Elder House Exit (East)").id,
    };
    const insanity = notedConnections("open", noted("insanity", "open", notes));
    expect(insanity.decoupled).toBe(true);
    expect(insanity.complete).toBe(false);
    expect(insanity.connections.get("Kakariko Shop")).toBe(
      vanillaConnections("open").get("Elder House (East)"),
    );
    expect(insanity.connections.has("Elder House Exit (East)")).toBe(false);
    const crossed = notedConnections("open", noted("crossed", "open", notes));
    expect(crossed.connections.get("Elder House Exit (East)")).toBe(
      vanillaConnections("open").get("Kakariko Shop Exit") ??
        crossed.connections.get("Elder House Exit (East)"),
    );
    expect(crossed.connections.has("Elder House Exit (East)")).toBe(true);
  });

  it("lets the Inverted save point out where its door was noted", () => {
    const notes = {
      "dark-sanctuary-hint": drTargetOf("Dark Sanctuary Hint").id,
    };
    const built = notedConnections(
      "inverted",
      noted("crossed", "inverted", notes),
      156,
    );
    expect(built.connections.get("Dark Sanctuary Hint Exit")).toBe(
      vanillaConnections("inverted", 158).get("Dark Sanctuary Hint Exit"),
    );
  });

  it("runs DR's key analysis on a dungeon once its ways in are known", () => {
    // dungeonssimple, Eastern Palace's door noted alone: Eastern Palace is
    // known, the others wait
    const eastern = vanillaNotes("dungeonssimple", "open", (name) =>
      ["Eastern Palace"].includes(name),
    );
    const built = notedConnections(
      "open",
      noted("dungeonssimple", "open", eastern),
    );
    const told = portalsKnown("open", built.connections);
    expect(told.has("Eastern Palace")).toBe(true);
    expect(told.has("Desert Palace")).toBe(false);
    expect(told.has("Skull Woods")).toBe(false);
    const all = notedConnections(
      "open",
      noted("dungeonssimple", "open", vanillaNotes("dungeonssimple", "open")),
    );
    // Every door where it was: the dungeons the vanilla world's walk
    // reaches by their every portal; Desert's, Skull Woods' and Turtle
    // Rock's ledges are reached only through them (find_inaccessible_
    // regions): DR's analysis starts them from another portal, after
    // others, which only the whole world tells (analyze_portals)
    const whole = portalsKnown("open", all.connections);
    expect(whole).toEqual(portalsKnown("open", vanillaConnections("open")));
    expect(whole.size).toBe(10);
    for (const ledge of ["Desert Palace", "Skull Woods", "Turtle Rock"])
      expect(whole.has(ledge), ledge).toBe(false);

    // Wild keys, a dungeon's analysis asks fewer keys than every key of
    // it: Ganon's Tower's Firesnake Room asks 3 of its 8 (partial logic)
    const wild = settings("open", { wildBigKeys: true, wildKeys: true });
    const state = (keys: number): State => ({
      ...everything(settingsFromUpstream("open")),
      keyA2: keys,
    });
    const firesnake = drLocationId("Ganons Tower - Firesnake Room");
    const solve = (world: ReturnType<typeof drWorld>, keys: number) =>
      solveFacts(world, state(keys)).location(firesnake);
    const vanilla = drWorld(wild);
    const known = drWorld(wild, {
      entrances: noted(
        "dungeonssimple",
        "open",
        vanillaNotes("dungeonssimple", "open"),
      ),
    });
    const partly = drWorld(wild, {
      entrances: noted(
        "dungeonssimple",
        "open",
        vanillaNotes("dungeonssimple", "open", (name) => name !== "Ice Palace"),
      ),
    });
    let fewest = 0;
    while (solve(vanilla, fewest) !== "yes") fewest++;
    expect(fewest).toBeLessThan(8);
    expect(solve(known, fewest)).toBe("yes");
    expect(solve(known, fewest - 1)).toBe(solve(vanilla, fewest - 1));
    // Ice Palace not noted: Ganon's Tower is known still
    expect(solve(partly, fewest)).toBe("yes");
    // Ganon's Tower's door not noted: unreached
    const noGT = drWorld(wild, {
      entrances: noted(
        "dungeonssimple",
        "open",
        vanillaNotes(
          "dungeonssimple",
          "open",
          (name) => name !== "Ganons Tower",
        ),
      ),
    });
    expect(solve(noGT, 99)).toBe("no");
  });

  it("asks every key where a dungeon's ways in are not all known", () => {
    // Desert Palace with its north door unnoted: the dungeon is reached by
    // its front, its key doors ask every key (strict-safe)
    const wild = settings("open", { wildBigKeys: true, wildKeys: true });
    const notes = vanillaNotes(
      "dungeonssimple",
      "open",
      (name) => name !== "Desert Palace Entrance (North)",
    );
    const built = notedConnections(
      "open",
      noted("dungeonssimple", "open", notes),
    );
    expect(portalsKnown("open", built.connections).has("Desert Palace")).toBe(
      false,
    );
    const world = drWorld(wild, {
      entrances: noted("dungeonssimple", "open", notes),
    });
    const vanilla = drWorld(wild);
    const state = (keys: number): State => ({
      ...everything(settingsFromUpstream("open")),
      keyP2: keys,
    });
    const torch = drLocationId("Desert Palace - Big Key Chest");
    expect(solveFacts(vanilla, state(1)).location(torch)).toBe("yes");
    expect(solveFacts(world, state(1)).location(torch)).not.toBe("yes");
  });

  it("asks the mirror for the swamp until its doors are known moved", () => {
    // dungeonssimple: the Dam stays; Swamp Palace's door unnoted, or noted
    // where it was, asks the mirror (no patch); moved, the patch opens it
    const noMirror = {
      ...everything(settingsFromUpstream("open")),
      magicMirror: 0,
    };
    const entrance = drLocationId("Swamp Palace - Entrance");
    const at = (notes: Record<string, string>) =>
      solveFacts(
        drWorld(settings("open"), {
          entrances: noted("dungeonssimple", "open", notes),
        }),
        noMirror,
      ).location(entrance);
    const vanilla = vanillaNotes("dungeonssimple", "open");
    expect(at(vanilla)).toBe("no");
    expect(
      at({
        ...vanilla,
        "ice-palace": drTargetOf("Swamp Palace Exit").id,
        "swamp-palace": drTargetOf("Ice Palace Exit").id,
      }),
    ).toBe("yes");
  });

  it("holds a rule reading a region's side in every side", () => {
    expect(everySide("lamp")).toBe("lamp");
    expect(everySide("!setting(darkWorld_a) | bow")).toBe(
      "(true | bow) & (false | bow)",
    );
    expect(everySide("setting(lightWorld_a) & sword")).toBe(
      "(false & sword) & (true & sword)",
    );
    expect(
      everySide(
        "setting(lightWorld_a) & setting(darkWorld_b) & setting(lightWorld_c) & setting(darkWorld_d) & setting(lightWorld_e)",
      ),
    ).toBe("maybe");
  });

  it("reads the Kings Grave case of the bomb shop by release", () => {
    // 1.5.7 named the Village of Outcasts where 1.5.6 read a region DR no
    // longer had (9f688f8): a 1.5.6 seed never took that way
    const notes = {
      ...vanillaNotes("crossed", "open"),
      "big-bomb-shop": drTargetOf("Kings Grave").id,
      "kings-grave": drTargetOf("Big Bomb Shop").id,
    };
    const state = {
      ...everything(settingsFromUpstream("open")),
      flute: 0,
      glove: 1,
    };
    const fairy = (version: number) =>
      solveFacts(
        drWorld(settings("open", { drVersion: version }), {
          entrances: noted("crossed", "open", notes),
          probes: ["Pyramid Fairy"],
        }),
        state,
      ).location(probeId("Pyramid Fairy"));
    expect(fairy(158)).toBe("yes");
    expect(fairy(156)).not.toBe("yes");
  });
});
