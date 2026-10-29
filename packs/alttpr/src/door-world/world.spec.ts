import type { Settings } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { solveFacts } from "../facts";
import { settingsFromUpstream } from "../settings";
import {
  dynamicExits,
  isStaticExit,
  REMOVED_EXITS,
  vanillaConnections,
} from "./connections";
import { DR_REGIONS, pairsOf, REGION_NAMED } from "./data";
import { DR_DEFAULTS, drLocationId, drWorld, markWorlds } from "./index";

const settings = (mode: "open" | "inverted"): Settings => ({
  ...DR_DEFAULTS,
  ...settingsFromUpstream(mode),
});

describe("the Door Randomizer's world (door-world)", () => {
  it("links every exit to a region of DR's, as DR's vanilla world does", () => {
    for (const mode of ["open", "standard", "inverted"] as const) {
      const connections = vanillaConnections(mode);
      for (const [exit, to] of connections) {
        expect(isStaticExit(exit), exit).toBe(true);
        expect(REGION_NAMED.has(to), to).toBe(true);
      }
      // Unlinked: a one-way door's far side, an exit only the other
      // worlds' mandatory tables link, the inverted sanctuary's way out
      // (a single entrance, EntranceShuffle2.py single_entrance_map) and
      // the removed mirror route
      const other = new Set(
        [
          ...pairsOf(
            "OverworldShuffle.py",
            mode === "inverted"
              ? "open_mandatory_connections"
              : "inverted_mandatory_connections",
          ),
          ...pairsOf("EntranceShuffle2", "drop_map"),
          ...pairsOf("EntranceShuffle2", "entrance_map"),
        ].map(([exit]) => exit),
      );
      const farSides = new Set(
        pairsOf("DoorShuffle.py", "default_one_way_connections").map(
          ([, to]) => to,
        ),
      );
      const unlinked = DR_REGIONS.flatMap((r) => r.exits).filter(
        (exit) =>
          !connections.has(exit) && !farSides.has(exit) && !other.has(exit),
      );
      expect(unlinked, mode).toEqual([
        "Dark Sanctuary Hint Exit",
        "Sanctuary Mirror Route",
      ]);
      for (const exit of REMOVED_EXITS)
        expect(connections.has(exit)).toBe(false);
    }
  });

  it("swaps the Inverted world's entrances (EntranceShuffle2.py:64-78)", () => {
    const open = vanillaConnections("open");
    const inverted = vanillaConnections("inverted");
    expect(open.get("Ganons Tower")).toBe("Ganons Tower Portal");
    expect(inverted.get("Ganons Tower")).toBe("Agahnims Tower Portal");
    expect(inverted.get("Agahnims Tower")).toBe("Ganons Tower Portal");
    expect(inverted.get("Links House")).toBe("Big Bomb Shop");
    expect(open.get("Pyramid Hole")).toBe("Pyramid");
    expect(inverted.has("Pyramid Hole")).toBe(false);
    expect(inverted.get("Inverted Pyramid Hole")).toBe("Pyramid");
    expect(open.get("Chris Houlihan Room Exit")).toBe(
      open.get("Links House Exit"),
    );
  });

  it("makes the flute and mirror exits DR makes in code, of new names", () => {
    for (const mode of ["open", "inverted"] as const) {
      const exits = dynamicExits(mode);
      const names = exits.map((e) => e.name);
      expect(new Set(names).size).toBe(names.length);
      for (const name of names) expect(isStaticExit(name), name).toBe(false);
      const own = mode === "open" ? "lw" : "dw";
      for (const exit of exits)
        expect(REGION_NAMED.get(exit.from)?.type).toBe(
          exit.to === "Flute Sky" ? own : own === "lw" ? "dw" : "lw",
        );
    }
    expect(
      dynamicExits("open").find((e) => e.name === "Flute From Zoras Domain"),
    ).toBeUndefined();
  });

  it("marks the worlds through the exits, never across", () => {
    const world = drWorld(settings("open"));
    expect(world.locationIds.size).toBeGreaterThan(200);
    const marked = markWorlds(
      [...vanillaConnections("open")].map(([name, to]) => ({
        from: DR_REGIONS.find((r) => r.exits.includes(name))?.name ?? "",
        name,
        req: "true",
        to,
      })),
    );
    expect(marked.light.has("Links House")).toBe(true);
    expect(marked.dark.has("Links House")).toBe(false);
    expect(marked.dark.has("Palace of Darkness Portal")).toBe(true);
    expect(marked.light.has("Eastern Lobby")).toBe(true);
  });

  it("gives each location one id", () => {
    for (const mode of ["open", "standard", "inverted"] as const) {
      const world = drWorld({
        ...DR_DEFAULTS,
        ...settingsFromUpstream(mode),
      });
      const ids = [...world.locationIds.values()];
      expect(new Set(ids).size, mode).toBe(ids.length);
    }
    expect(drLocationId("Hyrule Castle - Zelda's Chest")).toBe(
      "hyrule-castle/zeldas-cell",
    );
  });

  it("starts at the Menu, its save-and-quit points reached", () => {
    const world = drWorld(settings("open"));
    const solution = solveFacts(world, { heartContainer: 3 });
    expect(solution.location(drLocationId("Link's House"))).toBe("yes");
    expect(solution.location(drLocationId("Sanctuary"))).toBe("yes");
    // The bunny: past Agahnim, a dark world cave's chest needs the pearl,
    // the Pyramid's ledge item does not (bunny_accessible_locations)
    const held = {
      defeatAgahnim: 1,
      glove: 1,
      hammer: 1,
      heartContainer: 3,
      magicMirror: 1,
    };
    const bunny = solveFacts(world, held);
    const link = solveFacts(world, { ...held, moonPearl: 1 });
    expect(bunny.location(drLocationId("Hype Cave - Top"))).toBe("no");
    expect(link.location(drLocationId("Hype Cave - Top"))).toBe("yes");
    expect(bunny.location(drLocationId("Pyramid"))).toBe("yes");
  });
});
