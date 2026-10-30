import { MARKERS } from "@alltp/pack-alttpr";
import { describe, expect, it } from "vitest";
import { getPreset } from "@/games/alttpr/data/presets";
import {
  entranceById,
  entranceText,
  gameNotes,
  layoutOf,
  notesFor,
  placeMarkers,
  poolOf,
  targetById,
  targetsFor,
  targetText,
} from "@/games/alttpr/logic/entrances";

const crosskeys = getPreset("crosskeys").settings;

describe("the entrance assistant's model", () => {
  it("has a pool for runs with shuffled entrances in Open and Standard", () => {
    expect(poolOf(getPreset("open").settings)).toBeNull();
    expect(poolOf(crosskeys)?.entrances).toHaveLength(138);
    expect(
      poolOf({ ...crosskeys, mode: "standard" })?.entrances.length,
    ).toBeLessThan(138);
    // Inverted shuffles with tables of its own, not ported yet
    expect(poolOf({ ...crosskeys, mode: "inverted" })).toBeNull();
  });

  it("offers a Retro run's doors its take-any caves", () => {
    const retro = { ...crosskeys, mode: "retro" as const };
    const ids = (settings: typeof crosskeys) =>
      poolOf(settings)
        ?.targetsOf.get("kakariko-shop")
        ?.map((t) => t.id) ?? [];
    expect(ids(retro)).toContain("take-any-1");
    expect(ids(retro)).toContain("old-man-sword-cave");
    expect(ids(crosskeys)).not.toContain("take-any-1");
    expect(ids({ ...retro, entranceShuffle: "full" })).toContain("take-any-1");
  });

  it("has a pool of its own for each shuffle it ports, made once, and none for Insanity", () => {
    const seen = new Set<unknown>();
    for (const entranceShuffle of [
      "simple",
      "restricted",
      "full",
      "crossed",
    ] as const)
      for (const mode of ["open", "retro", "standard"] as const) {
        const settings = { ...crosskeys, entranceShuffle, mode };
        const pool = poolOf(settings);
        expect(pool?.shuffle).toBe(entranceShuffle);
        expect(poolOf({ ...settings })).toBe(pool);
        seen.add(pool);
        // Whatever the dungeon items: the assistant is not the logic
        expect(poolOf({ ...settings, dungeonItems: "standard" })).toBe(pool);
        expect(poolOf({ ...settings, mode: "inverted" })).toBeNull();
      }
    expect(seen.size).toBe(12);
    expect(
      poolOf({ ...crosskeys, entranceShuffle: "simple" })?.entrances,
    ).toHaveLength(138);
    // Standard's simple shuffle keeps the castle's doors
    expect(
      poolOf({
        ...crosskeys,
        entranceShuffle: "simple",
        mode: "standard",
      })?.entrances.map((e) => e.id),
    ).not.toContain("agahnims-tower");
    // Insanity parts a door from its way out: not modelled yet
    expect(poolOf({ ...crosskeys, entranceShuffle: "insanity" })).toBeNull();
  });

  const pool = poolOf(crosskeys);
  if (pool === null) throw new Error("no pool");

  it("offers each entrance what the shuffle may give it", () => {
    const hole = entranceById("kakariko-well-drop");
    const door = entranceById("kakariko-shop");
    if (hole === undefined || door === undefined) throw new Error("missing");
    expect(new Set(targetsFor(pool, hole).map((t) => t.kind))).toEqual(
      new Set(["drop"]),
    );
    expect(targetsFor(pool, door).map((t) => t.kind)).not.toContain("drop");
  });

  it("notes a hole with its cave's door", () => {
    expect(notesFor(pool, "kakariko-well-drop", "bat-cave-right")).toEqual({
      "kakariko-well-cave": "bat-cave-exit",
      "kakariko-well-drop": "bat-cave-right",
    });
    expect(notesFor(pool, "kakariko-shop", "blinds-hideout")).toEqual({
      "kakariko-shop": "blinds-hideout",
    });
  });

  it("notes a four-door dungeon whole, and a simple pair's cave, where the shuffle moves them whole", () => {
    const simple = poolOf({ ...crosskeys, entranceShuffle: "simple" });
    const restricted = poolOf({ ...crosskeys, entranceShuffle: "restricted" });
    if (simple === null || restricted === null) throw new Error("no pool");
    // The Desert's doors lead into Hyrule Castle and Agahnim's Tower
    const desert = {
      "desert-palace-entrance-east": "hyrule-castle-exit-east",
      "desert-palace-entrance-north": "agahnims-tower-exit",
      "desert-palace-entrance-south": "hyrule-castle-exit-south",
      "desert-palace-entrance-west": "hyrule-castle-exit-west",
    };
    for (const shuffled of [simple, restricted])
      expect(
        notesFor(
          shuffled,
          "desert-palace-entrance-north",
          "agahnims-tower-exit",
        ),
      ).toEqual(desert);
    expect(
      notesFor(pool, "desert-palace-entrance-north", "agahnims-tower-exit"),
    ).toEqual({ "desert-palace-entrance-north": "agahnims-tower-exit" });
    // A pair of doors takes a two-door cave whole in the simple shuffle
    const pair = {
      "elder-house-east": "superbunny-cave-exit-bottom",
      "elder-house-west": "superbunny-cave-exit-top",
    };
    expect(
      notesFor(simple, "elder-house-west", "superbunny-cave-exit-top"),
    ).toEqual(pair);
    expect(
      notesFor(restricted, "elder-house-west", "superbunny-cave-exit-top"),
    ).toEqual({ "elder-house-west": "superbunny-cave-exit-top" });
  });

  it("notes what the game shows Link went through with what it settles", () => {
    const simple = poolOf({ ...crosskeys, entranceShuffle: "simple" });
    if (simple === null) throw new Error("no pool");
    // Through Turtle Rock's front door (its slot 52) into its front (exit_ids: 53)
    const notes = gameNotes(simple, {}, [
      { entrance: 53, kind: "door", slot: 52 },
    ]);
    expect(notes).toMatchObject({
      "dark-death-mountain-ledge-east": "turtle-rock-ledge-exit-east",
      "turtle-rock": "turtle-rock-exit-front",
    });
  });

  it("has DR's own pool for a Door Randomizer run, in any world", () => {
    const dr = getPreset("door-crosskeys").settings;
    const pool = poolOf(dr);
    expect(pool?.shuffle).toBe("crossed");
    expect(poolOf({ ...dr })).toBe(pool);
    // Its Inverted world's too, and its own shuffles
    expect(poolOf({ ...dr, mode: "inverted" })?.shuffle).toBe("crossed");
    expect(
      poolOf({ ...dr, doorEntrances: "dungeonssimple" })?.entrances.length,
    ).toBe(28);
    // Link's House and the Tavern's back: may be moved while unset, kept
    // where the run says so
    const ids = (settings: typeof dr) =>
      poolOf(settings)?.entrances.map((e) => e.id) ?? [];
    expect(ids(dr)).toContain("links-house");
    expect(ids(dr)).toContain("tavern-north");
    expect(
      ids({ ...dr, shuffleLinks: false, shuffleTavern: false }),
    ).not.toContain("links-house");
    expect(ids({ ...dr, shuffleLinks: true, shuffleTavern: true })).toContain(
      "links-house",
    );
    expect(targetById("links-house-exit")?.place).toBe("Link's House");
    expect(entranceById("inverted-pyramid-hole")?.kind).toBe("hole");
    // Through Turtle Rock's front door, as in the entrance randomizer's
    if (pool === null) throw new Error("no pool");
    expect(
      gameNotes(pool, {}, [{ entrance: 53, kind: "door", slot: 52 }]),
    ).toEqual({ "turtle-rock": "turtle-rock-exit-front" });
    // Insanity's exits lead elsewhere: the game's doors tell nothing
    const insanity = poolOf({ ...dr, entranceShuffle: "insanity" });
    expect(insanity?.decoupled).toBe(true);
    if (insanity === null) throw new Error("no pool");
    expect(
      gameNotes(insanity, {}, [{ entrance: 53, kind: "door", slot: 52 }]),
    ).toEqual({});
  });

  it("has the fork's own pool for an OWR run's District or Swapped", () => {
    const owr = {
      ...getPreset("door-randomizer").settings,
      customGoals: false,
      prizeShuffle: "none",
      randomizer: "owr",
      shuffleFollowers: false,
      shuffleLinks: false,
      shuffleTavern: false,
    } as const;
    const ids = (settings: Partial<typeof owr> & Record<string, unknown>) =>
      poolOf({ ...owr, ...settings })?.entrances.map((e) => e.id) ?? [];
    const district = poolOf({ ...owr, doorEntrances: "district" });
    expect(district?.shuffle).toBe("district");
    expect(district?.decoupled).toBe(false);
    // The fork's names, no Inverted one: its Inverted world flips screens
    expect(ids({ doorEntrances: "swapped", mode: "inverted" })).not.toContain(
      "inverted-pyramid-hole",
    );
    // Without shufflelinks the start house's door stands: Link's House, the
    // Big Bomb Shop in Inverted, neither while Mixed may flip its screen
    expect(ids({ doorEntrances: "district" })).not.toContain("links-house");
    expect(ids({ doorEntrances: "district" })).toContain("big-bomb-shop");
    expect(ids({ doorEntrances: "district", mode: "inverted" })).not.toContain(
      "big-bomb-shop",
    );
    expect(ids({ doorEntrances: "district", owMixed: true })).toEqual(
      expect.arrayContaining(["links-house", "big-bomb-shop"]),
    );
    expect(ids({ doorEntrances: "district" })).not.toContain("tavern-north");
    // A door seen in the game notes it, as in DR's pool
    if (district === null || district === undefined) throw new Error("no pool");
    expect(
      gameNotes(district, {}, [{ entrance: 53, kind: "door", slot: 52 }]),
    ).toEqual({ "turtle-rock": "turtle-rock-exit-front" });
    // DR's own Swapped keeps DR's pool
    expect(
      poolOf({ ...owr, doorEntrances: "swapped", randomizer: "dr" })?.entrances
        .length,
    ).toBeGreaterThan(0);
  });

  it("moves the checks inside a place above the door noted to lead there", () => {
    const blinds = MARKERS.find((m) => m.id === "blinds-hideout");
    const tomb = MARKERS.find((m) => m.id === "kings-tomb");
    const island = MARKERS.find((m) => m.id === "lake-hylia-island");
    if (!blinds || !tomb || !island) throw new Error("missing");
    const markers = [blinds, tomb, island];
    // Nothing noted: the places' markers wait, an outdoor one stays
    expect(placeMarkers(pool, {}, markers)).toEqual([island]);
    // Blind's Hideout behind the Big Bomb Shop's door, in the Dark World
    const placed = placeMarkers(
      pool,
      { "big-bomb-shop": "blinds-hideout" },
      markers,
    );
    const shop = layoutOf(pool).get("big-bomb-shop");
    expect(placed).toHaveLength(2);
    expect(placed[0]).toMatchObject({
      id: "blinds-hideout",
      x: shop?.x,
      y: (shop?.y ?? 0) - 2.6,
    });
  });

  it("draws doors side by side clear of one another, near their spot", () => {
    const layout = layoutOf(pool);
    const at = (id: string) => {
      const found = layout.get(id);
      if (found === undefined) throw new RangeError(id);
      return found;
    };
    // In world percents: a step across as long as one down
    const apart = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot((a.x - b.x) * 2, a.y - b.y);
    // Good Bee Cave hid behind Ice Rod Cave, its neighbour in one cliff
    const bee = entranceById("good-bee-cave");
    const ice = entranceById("ice-rod-cave");
    if (bee === undefined || ice === undefined) throw new Error("missing");
    expect(apart(bee, ice)).toBeLessThan(3.5);
    expect(apart(at("good-bee-cave"), at("ice-rod-cave"))).toBeGreaterThan(3.5);
    for (const entrance of pool.entrances) {
      expect(apart(at(entrance.id), entrance)).toBeLessThanOrEqual(3.5001);
    }
  });

  it("says an entrance and where it leads", () => {
    const door = entranceById("blinds-hideout");
    const target = targetById("elder-house-exit-east");
    if (door === undefined || target === undefined) throw new Error("missing");
    expect(targetText(target)).toBe("Elder House (East)");
    expect(entranceText(door, target)).toBe(
      "Blind's Hideout: leads to Elder House (East)",
    );
    expect(entranceText(door, undefined)).toBe(
      "Blind's Hideout: not known yet",
    );
  });
});
