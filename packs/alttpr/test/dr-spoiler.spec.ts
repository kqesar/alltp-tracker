import { readFileSync } from "node:fs";
import type { SpoilerResult } from "@alltp/spoiler";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { DR_LOCATIONS } from "../src/door-rando/locations";
import { erLocationId } from "../src/entrances";
import { locationId } from "../src/location";
import {
  avianartHashInName,
  parseDoorLog,
  textDocument,
  titleSeedOf,
} from "../src/spoiler/dr";
import { fileFacts, parseSpoiler } from "../src/spoiler/parse";
import type { AlttprSpoilerLog } from "../src/spoiler/read";

// DR's own text logs of two spoiler races, written by
// scripts/record-dr-spoilers.mjs (test/dr-spoilers/index.json)
const KEYSANITY = "DR_660701088_Spoiler.txt";
const KEY_DROPS = "DR_278438665_Spoiler.txt";

const textOf = (name: string) =>
  readFileSync(new URL(`dr-spoilers/${name}`, import.meta.url), "utf8");

// biome-ignore lint/suspicious/noExplicitAny: a document the specs edit by path
type Doc = Record<string, any>;

function logOf(result: SpoilerResult<AlttprSpoilerLog>): AlttprSpoilerLog {
  if (!result.ok) {
    throw new Error(`refused: ${result.error} ${result.detail ?? ""}`);
  }
  return result.value;
}

const refused = (result: SpoilerResult<AlttprSpoilerLog>) => {
  if (result.ok) throw new Error("accepted");
  return [result.error, result.detail];
};

const keysanity = logOf(parseSpoiler(textOf(KEYSANITY), KEYSANITY));
const keyDrops = logOf(parseSpoiler(textOf(KEY_DROPS), KEY_DROPS));

/** The `name: item` lines of a text log's Locations section, read apart. */
const locationLines = (text: string): [string, string][] => {
  const section = text.split("\nLocations:\n\n")[1]?.split("\n\n")[0] ?? "";
  return section.split("\n").map((line) => {
    const at = line.lastIndexOf(": ");
    return [line.slice(0, at), line.slice(at + 2)];
  });
};

const at = (log: AlttprSpoilerLog, id: string) => {
  const found = log.placements.find((p) => p.location === id);
  if (found === undefined) throw new Error(`no placement at ${id}`);
  return found;
};

const DR_ID = (name: string) => {
  const found = DR_LOCATIONS.find((location) => location.name === name);
  if (found === undefined) throw new Error(`no DR location ${name}`);
  return found.id;
};

/** DR's to_json of a text log: its sections and a meta keyed by player. */
const jsonOf = (name: string): Doc => {
  const doc = textDocument(textOf(name)) as Doc;
  const { players, seed, teams, version, ...rest } = doc.meta;
  return {
    Bottles: { "Pyramid Bottle": "Bottle (Green Potion)" },
    Doors: [],
    DoorTypes: [],
    Entrances: [],
    Lobbies: [],
    ...doc,
    meta: {
      ...Object.fromEntries(
        Object.entries(rest).map(([key, value]) => [key, { 1: value }]),
      ),
      players: 1,
      seed: Number(seed),
      teams: 1,
      version,
    },
    playthrough: { 0: ["Pegasus Boots"], ...doc.playthrough },
  };
};

describe("DR's text log", () => {
  it("reads every location of the Locations section, events aside", () => {
    const lines = locationLines(textOf(KEYSANITY));
    expect(lines).toHaveLength(231);
    const events = lines.filter(([, item]) =>
      [
        "Beat Agahnim 1",
        "Beat Agahnim 2",
        "Get Frog",
        "Open Floodgate",
        "Pick Up Purple Chest",
        "Return Smith",
      ].includes(item),
    );
    expect(keysanity.placements).toHaveLength(lines.length - events.length);
    expect(events).toHaveLength(4);
    expect([...keysanity.skipped].sort()).toEqual([
      "Agahnim 1",
      "Agahnim 2",
      "Dark Blacksmith Ruins",
      "Frog",
    ]);
    expect(keysanity.format).toBe("dr");
    expect(keysanity.game).toBe("alttpr");
  });

  it("names each location by the pack's id, an item by the pack's", () => {
    expect(at(keysanity, erLocationId("Master Sword Pedestal"))).toEqual({
      area: null,
      item: "hookshot",
      itemName: "Hookshot",
      location: locationId("Master Sword Pedestal"),
      locationName: "Master Sword Pedestal",
      sphere: 13,
    });
    // DR writes Moldorm's chest by the entrance randomizer's name
    expect(
      at(keysanity, locationId("Ganon's Tower - Moldorm Chest")),
    ).toMatchObject({ itemName: "Boss Heart Container" });
    expect(keysanity.extra.prizes).toMatchObject({
      "eastern-palace": "crystal5",
      "palace-of-darkness": "pendantOfCourage",
    });
  });

  it("reads the seed, the title screen's code, the version and the settings", () => {
    expect(keysanity.seed).toEqual({ from: "content", id: "1_1_660701088" });
    expect(keysanity.extra.door).toEqual({
      avianart: null,
      code: "Powder, Key, Bottle, Compass, Pearl",
      overworld: false,
      title: "1_1_660701088",
      version: "1.5.6-u",
    });
    const settings = keysanity.extra.settings;
    expect(settings).toMatchObject({
      crystalsGanon: { known: true, value: 7 },
      crystalsTower: { known: true, value: 4 },
      logic: { known: true, value: "NoGlitches" },
      mode: { known: true, value: "open" },
      seed: "1_1_660701088",
      wildBigKeys: { known: true, value: true },
      wildKeys: { known: true, value: true },
    });
    expect(settings?.door).toMatchObject({
      doorShuffle: { known: true, value: "vanilla" },
      dropShuffle: { known: true, value: "none" },
      version: { known: true, value: "1.5.6" },
    });
    expect(fileFacts(keysanity).map((fact) => fact.name)).toEqual(
      expect.arrayContaining(["logic", "medallion:mire", "prize:ice-palace"]),
    );
  });

  it("reads the medallions, the playthrough and the shops", () => {
    expect(keysanity.extra.medallions).toEqual({
      mire: "quake",
      turtleRock: "ether",
    });
    expect(keysanity.spheres).toBe(20);
    expect(at(keysanity, locationId("Bottle Merchant")).sphere).toBe(1);
    expect(keysanity.extra.shops).toEqual([
      {
        items: [
          { name: "Bomb Upgrade (+5)", price: 100 },
          { name: "Arrow Upgrade (+5)", price: 100 },
        ],
        location: "Capacity Upgrade",
        type: "Shop",
      },
    ]);
    expect(keysanity.extra.bosses).toBeNull();
  });

  it("reads key drops and key pots as the pack's DR locations", () => {
    const drops = locationLines(textOf(KEY_DROPS)).filter(([name]) =>
      / (?:Key Drop|Pot Key)$/.test(name),
    );
    expect(drops).toHaveLength(33);
    for (const [name, item] of drops) {
      expect(at(keyDrops, DR_ID(name))).toMatchObject({
        itemName: item,
        locationName: name,
      });
    }
    // A key pot the playthrough needs, with Misery Mire's key in it
    expect(
      at(keyDrops, DR_ID("Thieves' Town - Hallway Pot Key")),
    ).toMatchObject({ item: "keyD6", sphere: expect.any(Number) });
    expect(keyDrops.extra.settings?.door).toMatchObject({
      dropShuffle: { known: true, value: "keys" },
      pottery: { known: true, value: "beyond-caves" },
      version: { known: true, value: "1.5.7" },
    });
  });

  it("reads an item DR printed as Player 1's, and one vt has no class for", () => {
    const text = textOf(KEY_DROPS).replace(
      "Hyrule Castle - Map Guard Key Drop: Arrows (10)",
      "Hyrule Castle - Map Guard Key Drop: Rupees (300) (Player 1)",
    );
    const log = logOf(parseSpoiler(text, KEY_DROPS));
    expect(at(log, DR_ID("Hyrule Castle - Map Guard Key Drop"))).toMatchObject({
      item: null,
      itemName: "Rupees (300)",
    });
    const fairy = logOf(
      parseSpoiler(
        textOf(KEY_DROPS).replace(
          "Hyrule Castle - Map Guard Key Drop: Arrows (10)",
          "Hyrule Castle - Map Guard Key Drop: Fairy",
        ),
        KEY_DROPS,
      ),
    );
    expect(
      at(fairy, DR_ID("Hyrule Castle - Map Guard Key Drop")),
    ).toMatchObject({ item: null, itemName: "Fairy" });
  });

  it("refuses an item no table knows, another player's, a multiworld", () => {
    const text = textOf(KEYSANITY);
    expect(
      refused(
        parseSpoiler(
          text.replace(
            "Mushroom: Boss Heart Container",
            "Mushroom: Moon Boots",
          ),
          KEYSANITY,
        ),
      ),
    ).toEqual(["newer-version", "Moon Boots"]);
    expect(
      refused(
        parseSpoiler(
          text.replace(
            "Mushroom: Boss Heart Container",
            "Mushroom: Boss Heart Container (Player 2)",
          ),
          KEYSANITY,
        ),
      ),
    ).toEqual(["unsupported", "multiworld"]);
    expect(
      refused(
        parseSpoiler(
          text.replace(/^Players: +1$/m, "Players:                         2"),
          KEYSANITY,
        ),
      ),
    ).toEqual(["unsupported", "multiworld"]);
  });

  it("refuses a log with its settings and no placement", () => {
    const header = textOf(KEYSANITY).split("\nLocations:\n")[0] ?? "";
    expect(refused(parseSpoiler(header, KEYSANITY))).toEqual([
      "stripped",
      "door-race",
    ]);
    expect(
      refused(
        parseSpoiler(
          header.replace(
            /^Race: +Yes$/m,
            "Race:                            No",
          ),
          KEYSANITY,
        ),
      ),
    ).toEqual(["stripped", "door-settings"]);
  });

  it("never throws on a cut or garbled log", () => {
    const text = textOf(KEY_DROPS);
    fc.assert(
      fc.property(
        fc.nat(text.length),
        fc.string({ maxLength: 40 }),
        (cut, noise) => {
          const result = parseSpoiler(text.slice(0, cut) + noise, KEY_DROPS);
          expect(typeof result.ok).toBe("boolean");
        },
      ),
      { numRuns: 60 },
    );
  });
});

describe("DR's JSON log", () => {
  it("reads to_json's sections, a meta keyed by player and the starting list", () => {
    const doc = jsonOf(KEYSANITY);
    const { Locations, ...rest } = doc;
    const log = logOf(
      parseSpoiler(
        JSON.stringify({
          ...rest,
          "Light World": {
            "Master Sword Pedestal": Locations["Master Sword Pedestal"],
          },
          "Starting Inventory": ["Pegasus Boots"],
          Unplaced: Object.fromEntries(
            Object.entries(Locations).filter(
              ([name]) => name !== "Master Sword Pedestal",
            ),
          ),
        }),
      ),
    );
    expect(log.placements).toHaveLength(keysanity.placements.length);
    expect(at(log, locationId("Master Sword Pedestal")).area).toBe(
      "Light World",
    );
    expect(log.start).toEqual(["Pegasus Boots"]);
    expect(log.seed).toEqual({ from: "content", id: "1_1_660701088" });
    expect(log.spheres).toBe(keysanity.spheres);
    expect(log.extra.settings?.wildKeys).toEqual({ known: true, value: true });
    // Bottles, Doors and the rest are no locations
    expect([...log.skipped].sort()).toEqual([...keysanity.skipped].sort());
  });

  it("strips the dungeon a crossed door shuffle names and an enemy's note", () => {
    const doc = jsonOf(KEY_DROPS);
    const { Locations } = doc;
    const item = Locations["Hyrule Castle - Map Guard Key Drop"];
    delete Locations["Hyrule Castle - Map Guard Key Drop"];
    Locations[
      "Hyrule Castle - Map Guard Key Drop @ Ganons Tower (Blue Guard)"
    ] = item;
    const chest = Locations["Eastern Palace - Big Chest"];
    delete Locations["Eastern Palace - Big Chest"];
    Locations["Eastern Palace - Big Chest @ Swamp Palace"] = chest;
    const log = logOf(parseSpoiler(JSON.stringify(doc), "DR_1_Spoiler.json"));
    expect(at(log, DR_ID("Hyrule Castle - Map Guard Key Drop"))).toMatchObject({
      itemName: item,
      locationName: "Hyrule Castle - Map Guard Key Drop",
    });
    expect(at(log, locationId("Eastern Palace - Big Chest")).itemName).toBe(
      chest,
    );
  });

  it("takes avianart's hash from its file name or its permalink's answer", () => {
    const doc = jsonOf(KEYSANITY);
    delete doc.meta.seed;
    const name = "alttprcustom - DR__C2BdrZOiV_Spoiler.txt";
    const named = logOf(parseSpoiler(JSON.stringify(doc, null, 4), name));
    expect(named.seed).toEqual({ from: "file-name", id: "C2BdrZOiV" });
    expect(named.extra.door?.avianart).toBe("C2BdrZOiV");
    const wrapped = logOf(
      parseSpoiler(
        JSON.stringify({ response: { hash: "u6BKiwo1E", spoiler: doc } }),
      ),
    );
    expect(wrapped.extra.door?.avianart).toBe("u6BKiwo1E");
    expect(
      avianartHashInName("alttprcustom - DR__C2BdrZOiV_Spoiler (1).txt"),
    ).toBe("C2BdrZOiV");
    expect(avianartHashInName("alttpr - x_C2BdrZOiV.txt")).toBeNull();
  });

  it("refuses a race seed's permalink, which keeps its meta alone", () => {
    // The real answer avianart gives for a race seed (record-dr-seeds)
    const permalink = readFileSync(
      new URL("dr-seeds/avianart-C2BdrZOiV.json", import.meta.url),
      "utf8",
    );
    expect(refused(parseSpoiler(permalink, "C2BdrZOiV.json"))).toEqual([
      "stripped",
      "door-race",
    ]);
  });

  it("refuses a playthrough DR would not write, and a document without meta", () => {
    const doc = jsonOf(KEYSANITY);
    doc.playthrough["3"] = ["Hookshot"];
    expect(refused(parseSpoiler(JSON.stringify(doc)))).toEqual([
      "not-a-spoiler",
      "playthrough",
    ]);
    expect(
      refused(parseDoorLog({ json: { Doors: [] } }, "DR_1_Spoiler.json")),
    ).toEqual(["not-a-spoiler", "no meta"]);
    expect(
      refused(parseDoorLog({ text: "hello" }, "DR_1_Spoiler.txt")),
    ).toEqual(["not-a-spoiler", "not DR's first line"]);
  });
});

describe("titleSeedOf", () => {
  it("writes the seed as DR's ROM title does, nine digits at least", () => {
    expect(titleSeedOf(84527046)).toBe("1_1_084527046");
    expect(titleSeedOf("660701088")).toBe("1_1_660701088");
    // The title stops at 21 bytes, 15 of them after "DR156_"
    expect(titleSeedOf(123456789012)).toBe("1_1_12345678901");
    expect(titleSeedOf("seed")).toBeNull();
    expect(titleSeedOf(-1)).toBeNull();
  });
});
