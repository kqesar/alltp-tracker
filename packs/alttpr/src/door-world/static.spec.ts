// DR's static key logic (static.ts): what DR's own tests of it
// (test/dr-static.spec.ts) leave out, the releases' differences and the
// cases of Turtle Rock the vanilla Open world never takes.

import type { Settings } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { solveFacts } from "../facts";
import { everything } from "../keys";
import { settingsFromUpstream } from "../settings";
import { DR_DATA } from "./data";
import {
  DR_DEFAULTS,
  drKeyLogic,
  drLocationId,
  drWorld,
  turtleRockAccess,
} from "./index";
import { worldKeys } from "./keys";
import {
  addStaticKeyRules,
  staticKeyLogic,
  staticTablesOf,
  type TurtleRockCase,
  turtleRockCase,
} from "./static";

const settings = (mode: "open" | "standard" | "inverted"): Settings => ({
  ...DR_DEFAULTS,
  ...settingsFromUpstream(mode),
});

const OPEN = drKeyLogic(DR_DATA, settings("open"));
const ruleOf = (
  logic: ReturnType<typeof staticKeyLogic>,
  dungeon: string,
  door: string,
) => {
  const found = logic.get(dungeon)?.doorRules.get(door);
  if (found === undefined) throw new RangeError(`No rule for ${door}`);
  return found;
};

describe("DR's static key logic (StaticKeyLogic.py)", () => {
  it("reads every dungeon's table, a number its keys, a lone big key spot a list", () => {
    expect(Object.keys(staticTablesOf(DR_DATA).doors)).toHaveLength(13);
    expect(
      staticTablesOf(DR_DATA).doors["Ganons Tower"]?.["GT Hookshot ES"],
    ).toEqual({
      bigKeyIn: ["Ganons Tower - Map Chest"],
      keys: 4,
      smallKeyIn: "Ganons Tower - Map Chest",
      withBigKey: 3,
      withSmallKey: 3,
    });
    expect(staticTablesOf(DR_DATA).gtRandomizer).toHaveLength(4);
  });

  it("takes Turtle Rock's case from the ways in, back first (:234-266)", () => {
    const access = (back: boolean, front: boolean, middle: boolean) => ({
      back,
      bigChest: true,
      front,
      middle,
    });
    expect(turtleRockCase(access(true, true, true))).toBe("back");
    expect(turtleRockCase(access(false, true, true))).toBe("front-middle");
    expect(turtleRockCase(access(false, true, false))).toBe("front");
    expect(turtleRockCase(access(false, false, false))).toBe("big-chest");
    expect(
      turtleRockCase({
        back: false,
        bigChest: false,
        front: false,
        middle: false,
      }),
    ).toBeNull();
    // The vanilla worlds: Open and Standard reach the front alone (as DR's
    // own test says, test_turtle_rock_front_access), Inverted every way,
    // its mirror reaching the dark ledges; Standard before 1.5.7 none
    // (4222a44: no key out of the sewers)
    const front = { back: false, bigChest: false, front: true, middle: false };
    expect(turtleRockAccess(DR_DATA, "open", 158)).toEqual(front);
    expect(turtleRockAccess(DR_DATA, "standard", 158)).toEqual(front);
    expect(turtleRockAccess(DR_DATA, "standard", 156)).toEqual({
      ...front,
      front: false,
    });
    expect(turtleRockAccess(DR_DATA, "inverted", 158)).toEqual({
      back: true,
      bigChest: true,
      front: true,
      middle: true,
    });
  });

  it("sets each door of the table and its pair, counting chest keys", () => {
    const logic = staticKeyLogic(DR_DATA, OPEN, "front", 158);
    for (const [dungeon, l] of logic) {
      expect(l.chestCounting, dungeon).toBe(true);
      // The analysis's own logic is left as it was
      expect(OPEN.get(dungeon)?.chestCounting).toBeUndefined();
    }
    const tile = ruleOf(logic, "Ganons Tower", "GT Tile Room EN");
    expect([tile.worstCase, tile.smallKeyNum]).toEqual([3, 3]);
    // The door across a key door asks its number too (sm_doors)
    const door = ruleOf(logic, "Palace of Darkness", "PoD Middle Cage N");
    expect(door.worstCase).toBe(1);
    // An alternative of the table's own: the big key in the map chest
    const hookshot = ruleOf(logic, "Ganons Tower", "GT Hookshot ES");
    expect([hookshot.lockNum, hookshot.allowSmallNum]).toEqual([3, 3]);
  });

  it("strips the analysis's alternatives from 1.5.7 on, keeps them below the number before", () => {
    // GT Firesnake Room SW: the analysis lets the big key in the bottom
    // section open it with fewer keys; static asks 3, wherever it is
    const analysis = OPEN.get("Ganons Tower")?.doorRules.get(
      "GT Firesnake Room SW",
    );
    expect(analysis?.lockNum).toBeDefined();
    const newer = ruleOf(
      staticKeyLogic(DR_DATA, OPEN, "front", 157),
      "Ganons Tower",
      "GT Firesnake Room SW",
    );
    expect([newer.worstCase, newer.lockNum]).toEqual([3, undefined]);
    const older = ruleOf(
      staticKeyLogic(DR_DATA, OPEN, "front", 156),
      "Ganons Tower",
      "GT Firesnake Room SW",
    );
    expect(older.worstCase).toBe(3);
    expect(older.lockNum).toBeLessThan(3);
  });

  it("sets Turtle Rock's doors by its case and the seed's release", () => {
    const tr = (trCase: TurtleRockCase, version: number, door: string) =>
      ruleOf(
        staticKeyLogic(DR_DATA, OPEN, trCase, version),
        "Turtle Rock",
        door,
      );
    // The front: 2 and 1 (:246-250)
    expect(tr("front", 158, "TR Chain Chomps Down Stairs").worstCase).toBe(2);
    expect(tr("front", 158, "TR Hub NW").worstCase).toBe(1);
    // The back: the crystaroller 4, Pokey 2 open to the chest's own key
    // from 1.5.7 (3416af0), from the front and middle from 1.5.8 (5d8f8ec)
    expect(tr("back", 158, "TR Crystaroller Down Stairs").worstCase).toBe(4);
    expect(tr("back", 157, "TR Pokey 2 ES").allowSmallNum).toBe(0);
    // Before, the analysis's own, kept below the number, never no key
    expect(tr("back", 156, "TR Pokey 2 ES").allowSmallNum).toBe(3);
    expect(tr("front-middle", 158, "TR Pokey 2 ES").allowSmallNum).toBe(0);
    expect(
      tr("front-middle", 157, "TR Pokey 2 ES").allowSmallNum,
    ).toBeUndefined();
    // The big chest's ledge: the first section's doors at 2 with the big
    // key there (:253-261)
    const chomps = tr("big-chest", 158, "TR Chain Chomps SW");
    expect([chomps.lockNum, chomps.alternateSmallKey]).toEqual([2, 2]);
    expect(chomps.alternateBigKeyLoc.size).toBe(3);
    // No way in found (Standard before 1.5.7): the table's numbers
    const none = staticKeyLogic(DR_DATA, OPEN, null, 156);
    expect(ruleOf(none, "Turtle Rock", "TR Hub NW").worstCase).toBe(4);
    expect(
      ruleOf(none, "Turtle Rock", "TR Chain Chomps Down Stairs").worstCase,
    ).toBe(4);
  });

  it("refuses a table it cannot lay on the world", () => {
    // A door of the table no layout holds (apply_key_rule_specs raises)
    const gt = OPEN.get("Ganons Tower");
    if (gt === undefined) throw new RangeError("No Ganons Tower");
    expect(() =>
      staticKeyLogic(DR_DATA, new Map([["Ganons Tower", gt]]), "front", 158),
    ).toThrow(/is not a small key door/);
    const keys = worldKeys(DR_DATA, "dungeon", { drops: false, pots: false });
    expect(() =>
      addStaticKeyRules(DR_DATA, [], new Map(), keys, "open", null),
    ).toThrow(/No location/);
    const located = new Map(
      [
        "Hyrule Castle - Boomerang Chest",
        "Hyrule Castle - Zelda's Chest",
        "Desert Palace - Boss",
        "Desert Palace - Prize",
      ].map((name) => [name, "true"]),
    );
    expect(() =>
      addStaticKeyRules(DR_DATA, [], located, keys, "open", null),
    ).toThrow(/No exit/);
  });

  it("gives its chests their rules, keys of the chests alone", () => {
    const wild = drWorld({
      ...settings("open"),
      drVersion: 158,
      staticKeyLogic: true,
      wildBigKeys: true,
      wildKeys: true,
    });
    // Everything held but the keys asked about
    const all = everything(settingsFromUpstream("open"));
    const at = (location: string, keys: Record<string, number>) =>
      solveFacts(wild, { ...all, ...keys }).location(drLocationId(location));
    // Desert's boss: one key (:150-151), whatever the doors ask
    expect(at("Desert Palace - Boss", { keyP2: 0 })).toBe("no");
    expect(at("Desert Palace - Boss", { keyP2: 1 })).toBe("yes");
    // Hyrule Castle's two, out of Standard: the escape's key from a chest
    // (:145-148), the key rat's drop not counted
    expect(at("Hyrule Castle - Boomerang Chest", { keyH2: 0 })).toBe("no");
    expect(at("Hyrule Castle - Boomerang Chest", { keyH2: 1 })).toBe("yes");
    // Turtle Rock's big key chest: 4 keys, or as its own item says
    // (chest_keys_needed: its own small key, its big key): maybe
    expect(at("Turtle Rock - Big Key Chest", { keyD7: 3 })).toBe("maybe");
    expect(at("Turtle Rock - Big Key Chest", { keyD7: 4 })).toBe("yes");
  });
});
