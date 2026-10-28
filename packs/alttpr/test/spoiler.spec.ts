import { readFileSync } from "node:fs";
import { MAX_SPOILER_BYTES, type SpoilerResult } from "@alltp/spoiler";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { erLocationId } from "../src/entrances";
import { locationId } from "../src/location";
import { fileFacts, hashInName, parseSpoiler } from "../src/spoiler/parse";
import type { AlttprSpoilerLog } from "../src/spoiler/read";

// The real "Save Spoiler" files of seeds, written by scripts/spoiler-fixtures.mjs
const VT = "9MQ9gO1wMD";
const ER = "0yAObedRMV";
const DAILY = "eM43RgZ4Gj";
const MYSTERY = "xvJo0drkyJ";
const RETRO = "VMR3zKaKv5";
const STANDARD = "6v1ab7qmv7";

const textOf = (hash: string) =>
  readFileSync(new URL(`spoilers/${hash}.txt`, import.meta.url), "utf8");
const nameOf = (hash: string) => `alttpr - NoGlitches-open-ganon_${hash}.txt`;
// A fixture the specs edit at will, whatever it holds
// biome-ignore lint/suspicious/noExplicitAny: edited by path
type Doc = Record<string, any>;
const jsonOf = (hash: string) => JSON.parse(textOf(hash)) as Doc;

function logOf(result: SpoilerResult<AlttprSpoilerLog>): AlttprSpoilerLog {
  if (!result.ok) {
    throw new Error(`refused: ${result.error} ${result.detail ?? ""}`);
  }
  return result.value;
}

const vt = logOf(parseSpoiler(textOf(VT), nameOf(VT)));
const er = logOf(parseSpoiler(textOf(ER), nameOf(ER)));
const placement = (log: AlttprSpoilerLog, id: string) => {
  const found = log.placements.find((p) => p.location === id);
  if (found === undefined) throw new Error(`no placement at ${id}`);
  return found;
};

const refused = (text: string, name = "") => {
  const result = parseSpoiler(text, name);
  if (result.ok) throw new Error("accepted");
  return [result.error, result.detail];
};

/** The same text with its document changed. */
const changed = (hash: string, edit: (doc: Doc) => unknown) => {
  const doc = jsonOf(hash);
  return JSON.stringify(edit(doc) ?? doc);
};

describe("vt's own spoiler", () => {
  it("reads every location of the file: its 226 and the 4 of Special", () => {
    const doc = jsonOf(VT);
    const reserved = ["meta", "Shops", "Bosses", "Special", "Equipped"];
    const inSections = Object.entries(doc)
      .filter(([key]) => ![...reserved, "playthrough"].includes(key))
      .reduce((n, [, section]) => n + Object.keys(section).length, 0);
    expect(inSections).toBe(226);
    expect(Object.keys(doc.Special)).toHaveLength(4);
    expect(vt.placements).toHaveLength(230);
    expect(new Set(vt.placements.map((p) => p.location)).size).toBe(230);
    expect(vt.skipped).toEqual([]);
    expect(vt.format).toBe("vt");
    expect(vt.game).toBe("alttpr");
  });

  it("names each location by the pack's id, with the file's name and section", () => {
    expect(placement(vt, locationId("Chicken House"))).toEqual({
      area: "Light World",
      item: "sword",
      itemName: "Progressive Sword",
      location: locationId("Chicken House"),
      locationName: "Chicken House",
      sphere: 1,
    });
    expect(placement(vt, locationId("Ice Palace - Prize"))).toMatchObject({
      area: "Ice Palace",
      item: "crystal6",
    });
  });

  it("gives an item the pack has none for no item id, and keeps its name", () => {
    const rupees = vt.placements.filter((p) => p.item === null);
    expect(rupees).toHaveLength(76);
    expect(rupees.every((p) => p.itemName.length > 0)).toBe(true);
    // The two sides agree: the pack's id is what fromUpstream says
    expect(placement(vt, locationId("Hobo"))).toMatchObject({
      item: "pieceOfHeart",
      itemName: "Piece Of Heart",
    });
  });

  it("puts each location of the playthrough in its sphere, and no other", () => {
    const doc = jsonOf(VT);
    const inFile: [number, string][] = [];
    for (const [sphere, regions] of Object.entries(doc.playthrough)) {
      if (typeof regions === "number") continue;
      for (const locations of Object.values(regions as Doc)) {
        for (const name of Object.keys(locations)) {
          inFile.push([Number(sphere), name.replace(/:1$/, "")]);
        }
      }
    }
    expect(inFile).toHaveLength(34);
    // The last two are events vt does not list among the locations: the
    // defeat of Agahnim 2 in sphere 11, Ganon in 12
    const outside = inFile.filter(
      ([, name]) => !vt.placements.some((p) => p.locationName === name),
    );
    expect(outside).toEqual([
      [11, "Agahnim 2"],
      [12, "Ganon"],
    ]);
    const got = vt.placements
      .filter((p) => p.sphere !== null)
      .map((p) => [p.sphere, p.locationName]);
    expect(got.sort()).toEqual(
      inFile.filter((entry) => !outside.includes(entry)).sort(),
    );
    // The count is the file's, events included
    expect(vt.spheres).toBe(12);
    expect(doc.playthrough.longest_item_chain).toBe(12);
  });

  it("reads the starting items, medallions, prizes and shops", () => {
    expect(vt.start).toEqual([
      "Heart Container",
      "Heart Container",
      "Heart Container",
    ]);
    expect(vt.extra.medallions).toEqual({ mire: "quake", turtleRock: "ether" });
    // Each of the ten pendants and crystals sits in its dungeon
    expect(vt.extra.prizes).toEqual({
      "desert-palace": "pendantOfPower",
      "eastern-palace": "crystal1",
      "ice-palace": "crystal6",
      "misery-mire": "crystal7",
      "palace-of-darkness": "crystal2",
      "skull-woods": "crystal4",
      "swamp-palace": "pendantOfCourage",
      "thieves-town": "crystal3",
      "tower-of-hera": "crystal5",
      "turtle-rock": "pendantOfWisdom",
    });
    expect(vt.extra.shops).toHaveLength(10);
    expect(vt.extra.shops[0]).toEqual({
      items: [
        { name: "Red Potion", price: 150 },
        { name: "Small Heart", price: 10 },
        { name: "Ten Bombs", price: 50 },
      ],
      location: "Light World Kakariko Shop",
      type: "Shop",
    });
    // Bosses are kept only when the seed shuffles them
    expect(jsonOf(VT).Bosses).toBeDefined();
    expect(vt.extra.bosses).toBeNull();
  });

  it("keeps the bosses of a seed that shuffles them", () => {
    const shuffled = logOf(
      parseSpoiler(
        changed(VT, (doc) => {
          doc.meta["enemizer.boss_shuffle"] = "full";
        }),
        nameOf(VT),
      ),
    );
    expect(shuffled.extra.bosses).toEqual(jsonOf(VT).Bosses);
  });

  it("reads the settings as a seed file's meta is read", () => {
    expect(vt.extra.settings).toMatchObject({
      crystalsGanon: { known: true, value: 7 },
      goal: { known: true, value: "ganon" },
      logic: { known: true, value: "NoGlitches" },
      mode: { known: true, value: "open" },
      seed: VT,
    });
  });
});

describe("the entrance randomizer's spoiler", () => {
  it("reads its 233 locations: 227 of the pack and 6 events", () => {
    expect(er.format).toBe("er");
    expect(er.placements).toHaveLength(227);
    expect(er.skipped).toEqual([
      "Floodgate",
      "Missing Smith",
      "Frog",
      "Dark Blacksmith Ruins",
      "Agahnim 2",
      "Agahnim 1",
    ]);
    const doc = jsonOf(ER);
    const reserved = ["meta", "Shops", "Bosses", "Special", "Entrances"];
    const raw = Object.entries(doc)
      .filter(([key]) => ![...reserved, "playthrough", "paths"].includes(key))
      .reduce((n, [, section]) => n + Object.keys(section).length, 0);
    expect(raw).toBe(233);
  });

  it("maps the randomizer's names to the pack's ids and vt's items", () => {
    expect(placement(er, erLocationId("Hobo"))).toMatchObject({
      area: null,
      item: "keyD5",
      itemName: "Small Key (Ice Palace)",
      locationName: "Hobo",
    });
    // A name the randomizer writes otherwise than vt
    expect(placement(er, locationId("Hammer Pegs"))).toMatchObject({
      item: null,
      itemName: "Rupees (300)",
      locationName: "Peg Cave",
    });
    expect(
      placement(er, locationId("Desert Palace - Map Chest")),
    ).toMatchObject({ item: "hookshot", sphere: 1 });
    expect(placement(er, locationId("Ice Palace - Prize")).item).toBe(
      "crystal7",
    );
  });

  it("puts the flat playthrough in spheres, events left out", () => {
    const doc = jsonOf(ER);
    const names: [number, string][] = Object.entries<Record<string, string>>(
      doc.playthrough,
    ).flatMap(([sphere, locations]) =>
      Object.keys(locations).map((name): [number, string] => [
        Number(sphere),
        name,
      ]),
    );
    const inSpheres = er.placements.filter((p) => p.sphere !== null);
    const events = names.filter(([, name]) => er.skipped.includes(name));
    expect(names.length).toBe(inSpheres.length + events.length);
    expect(events.length).toBeGreaterThan(0);
    for (const [sphere, name] of names) {
      if (er.skipped.includes(name)) continue;
      expect(placement(er, erLocationId(name)).sphere).toBe(sphere);
    }
    expect(er.spheres).toBe(10);
  });

  it("reads the medallions, prizes and shops", () => {
    expect(er.extra.medallions).toEqual({
      mire: "ether",
      turtleRock: "bombos",
    });
    expect(Object.keys(er.extra.prizes)).toHaveLength(10);
    expect(er.extra.prizes["thieves-town"]).toBe("crystal6");
    expect(er.extra.shops[0]).toEqual({
      items: [
        { name: "Red Potion", price: 150 },
        { name: "Small Heart", price: 10 },
        { name: "Bombs (10)", price: 50 },
      ],
      location: "Cave Shop (Dark Death Mountain)",
      type: "Shop",
    });
    expect(er.start).toEqual([]);
    expect(er.extra.settings).toMatchObject({
      entrances: { known: true, value: "crossed" },
      wildKeys: { known: true, value: true },
    });
  });
});

describe("the seed", () => {
  it("is the hash in the file's name", () => {
    expect(vt.seed).toEqual({ from: "file-name", id: VT });
    expect(hashInName(`alttpr - mystery_${MYSTERY}.txt`)).toBe(MYSTERY);
    // A browser's copy, and a daily's name with underscores of its own
    expect(
      hashInName(`alttpr - Daily Challenge_ Oct 16, 2026_${DAILY} (1).txt`),
    ).toBe(DAILY);
    expect(hashInName(`alttpr - x_${VT}.json`)).toBe(VT);
  });

  it("is none in a renamed file, or a name without a hash", () => {
    for (const name of [
      "",
      "spoiler.txt",
      "spoiler (1).txt",
      "a_b.txt",
      `x_${VT}.sfc`,
    ]) {
      expect(hashInName(name), name).toBeNull();
    }
    expect(logOf(parseSpoiler(textOf(VT), "spoiler.txt")).seed).toEqual({
      from: null,
      id: null,
    });
    expect(logOf(parseSpoiler(textOf(VT))).extra.settings?.seed).toBeNull();
  });

  it("is the hash inside the seed file S3 keeps, over the file's name", () => {
    const wrapped = JSON.stringify({
      generated: "2026-10-16T16:17:42+00:00",
      hash: VT,
      logic: 31,
      patch: [],
      size: 2,
      spoiler: jsonOf(VT),
    });
    const log = logOf(parseSpoiler(wrapped, nameOf(ER)));
    expect(log.seed).toEqual({ from: "content", id: VT });
    expect(log.extra.settings?.seed).toBe(VT);
    expect(log.placements).toEqual(vt.placements);
  });

  it("states the facts a run can state too", () => {
    const facts = Object.fromEntries(
      fileFacts(vt).map((f) => [f.name, f.file]),
    );
    expect(facts).toMatchObject({
      crystalsGanon: 7,
      crystalsTower: 7,
      goal: "ganon",
      logic: "NoGlitches",
      "medallion:mire": "quake",
      "medallion:turtle-rock": "ether",
      mode: "open",
      "prize:ice-palace": "crystal6",
      swordless: false,
      wildKeys: false,
    });
    expect(facts).not.toHaveProperty("seed");
    expect(Object.keys(facts)).toHaveLength(
      Object.keys(facts).filter((k) => facts[k] !== undefined).length,
    );
  });
});

describe("what it refuses", () => {
  it("withholds a race seed's and a mystery seed's, with the site's reason", () => {
    expect(refused(textOf(DAILY), nameOf(DAILY))).toEqual(["stripped", "off"]);
    expect(refused(textOf(MYSTERY), nameOf(MYSTERY))).toEqual([
      "stripped",
      "mystery",
    ]);
    expect(refused(JSON.stringify({ meta: { spoilers: "generate" } }))).toEqual(
      ["stripped", "generate"],
    );
  });

  it("is not a spoiler when it holds no locations and says nothing of why", () => {
    expect(refused(JSON.stringify({ meta: { spoilers: "on" } }))[0]).toBe(
      "not-a-spoiler",
    );
    expect(refused(JSON.stringify({ meta: {} }))[0]).toBe("not-a-spoiler");
  });

  it("is not a spoiler when it is not a JSON object with a meta", () => {
    for (const text of [
      "",
      "not json",
      "[1,2,3]",
      "null",
      '"text"',
      "{}",
      '{"meta": 3, "Light World": {}}',
      textOf(VT).slice(0, 4000),
    ]) {
      expect(refused(text)[0], text.slice(0, 20)).toBe("not-a-spoiler");
    }
    // A ROM, a binary
    expect(refused("MZ\u0000\u0000\u0001")[0]).toBe("not-a-spoiler");
    expect(refused(textOf(VT), "alttpr.sfc")[0]).toBe("not-a-spoiler");
  });

  it("names another randomizer's file as such, and what it does not read", () => {
    expect(refused('{"item_priority": ["Morph"], "all_items": []}')).toEqual([
      "other-game",
      "sm",
    ]);
    expect(refused("- SMZ3 11.3.2 KAGO KAGO\nPlaythrough:\n")).toEqual([
      "other-game",
      "smz3",
    ]);
    expect(refused('{"seed":{"guid":"x","gameId":"smz3"}}')).toEqual([
      "other-game",
      "smz3",
    ]);
    expect(refused("Archipelago Version 0.6.8\n")).toEqual([
      "unsupported",
      "archipelago",
    ]);
    expect(refused("- SM 11.3.2 KAGO\n")).toEqual(["unsupported", "smz3-sm"]);
  });

  it("is too large over the bound, whatever it holds", () => {
    const big = `{"meta": {}, "x": "${"a".repeat(MAX_SPOILER_BYTES.alttpr)}"}`;
    expect(refused(big)).toEqual(["too-large", "1 MiB"]);
  });

  it("does not read a multiworld", () => {
    const worlds = (doc: Doc) => {
      doc.meta.worlds = 2;
    };
    expect(refused(changed(VT, worlds))).toEqual(["unsupported", "multiworld"]);
    expect(
      refused(
        changed(VT, (doc) => {
          doc["Light World"]["Hobo:2"] = doc["Light World"]["Hobo:1"];
          delete doc["Light World"]["Hobo:1"];
        }),
      ),
    ).toEqual(["unsupported", "multiworld"]);
    expect(
      refused(
        changed(VT, (doc) => {
          doc["Light World"]["Hobo:1"] = "Hookshot:2";
        }),
      ),
    ).toEqual(["unsupported", "multiworld"]);
    expect(
      refused(
        changed(VT, (doc) => {
          const [first] = Object.keys(doc.playthrough["1"]["Light World"]);
          doc.playthrough["1"]["Light World"][`${first?.split(":")[0]}:3`] =
            "Hookshot:1";
        }),
      ),
    ).toEqual(["unsupported", "multiworld"]);
    const players = (doc: Doc) => {
      doc.meta.players = 2;
    };
    expect(refused(changed(ER, players))).toEqual([
      "unsupported",
      "multiworld",
    ]);
  });

  it("asks for a newer tracker when an item is none of the pack's", () => {
    expect(
      refused(
        changed(VT, (doc) => {
          doc["Light World"]["Hobo:1"] = "MoonBoots:1";
        }),
      ),
    ).toEqual(["newer-version", "MoonBoots:1"]);
    expect(
      refused(
        changed(ER, (doc) => {
          doc.Caves.Brewery = "Moon Boots";
        }),
      ),
    ).toEqual(["newer-version", "Moon Boots"]);
  });

  it("asks for a newer tracker past a few unknown locations, and skips a few", () => {
    const rename = (count: number) =>
      changed(VT, (doc) => {
        const names = Object.keys(doc["Light World"]).slice(0, count);
        for (const name of names) {
          doc["Light World"][`New ${name}`] = doc["Light World"][name];
          delete doc["Light World"][name];
        }
      });
    const few = logOf(parseSpoiler(rename(4), nameOf(VT)));
    expect(few.skipped).toHaveLength(4);
    expect(few.skipped.every((name) => name.startsWith("New "))).toBe(true);
    expect(few.placements).toHaveLength(226);
    expect(refused(rename(5))[0]).toBe("newer-version");
  });

  it("is not a spoiler with a location twice, a bad playthrough or no placement", () => {
    expect(
      refused(
        changed(VT, (doc) => {
          doc["Death Mountain"]["Hobo:1"] = "Hookshot:1";
        }),
      ),
    ).toEqual(["not-a-spoiler", "twice: Hobo"]);
    expect(
      refused(
        changed(VT, (doc) => {
          doc.playthrough = [1, 2];
        }),
      ),
    ).toEqual(["not-a-spoiler", "playthrough"]);
    expect(
      refused(
        changed(VT, (doc) => {
          doc.playthrough.first = { "Light World": { "Hobo:1": "Hookshot:1" } };
        }),
      ),
    ).toEqual(["not-a-spoiler", "playthrough"]);
    expect(
      refused(
        changed(ER, (doc) => {
          doc.playthrough["0"] = { Hobo: "Ice Rod" };
        }),
      ),
    ).toEqual(["not-a-spoiler", "playthrough"]);
  });
});

describe("a retro seed's spoiler", () => {
  // World::getSpoiler writes every small key of a generic-key seed as a bare
  // `Key`, with no world (app/World.php:965)
  const retro = logOf(parseSpoiler(textOf(RETRO), nameOf(RETRO)));

  it("reads the bare Key as the generic key, 19 times", () => {
    const keys = retro.placements.filter((p) => p.itemName === "Key");
    expect(keys).toHaveLength(19);
    expect(keys.every((p) => p.item === null)).toBe(true);
    expect(retro.extra.settings?.mode).toEqual({ known: true, value: "retro" });
    expect(retro.placements).toHaveLength(
      Object.entries(jsonOf(RETRO)).reduce(
        (sum, [key, value]) =>
          [
            "meta",
            "Shops",
            "Bosses",
            "Special",
            "Equipped",
            "playthrough",
          ].includes(key)
            ? sum
            : sum + Object.keys(value as object).length,
        0,
      ) + 4,
    );
  });

  it("reads the shops that sell a key", () => {
    const sold = retro.extra.shops.flatMap((shop) =>
      shop.items.map((item) => item.name),
    );
    expect(sold).toContain("Key");
  });

  it("still refuses a bare name that is no item the site writes", () => {
    for (const bare of ["Hookshot", "Keys", "Key:2", "key"]) {
      expect(
        refused(
          changed(RETRO, (doc) => {
            const [first] = Object.keys(doc["Light World"]);
            doc["Light World"][first as string] = bare;
          }),
        ),
      ).toEqual(["unsupported", "multiworld"]);
    }
  });

  it("still refuses another world's item in a retro log", () => {
    expect(
      refused(
        changed(RETRO, (doc) => {
          const [first] = Object.keys(doc["Light World"]);
          doc["Light World"][first as string] = "Hookshot:2";
        }),
      ),
    ).toEqual(["unsupported", "multiworld"]);
  });

  it("reads a location that holds nothing, written bare", () => {
    const empty = logOf(
      parseSpoiler(
        changed(RETRO, (doc) => {
          const [first] = Object.keys(doc["Light World"]);
          doc["Light World"][first as string] = "Nothing";
        }),
        nameOf(RETRO),
      ),
    );
    expect(
      empty.placements.filter((p) => p.itemName === "Nothing"),
    ).toHaveLength(1);
  });
});

describe("a Standard seed's spoiler, whose playthrough starts at sphere 0", () => {
  // The uncle's sword is a pre-collected item, which the playthrough lists as
  // sphere 0: `{ "Equipped": { "Equipment Slot 1": "UncleSword:1" } }`
  // (PlaythroughService.php:220-235)
  const standard = logOf(parseSpoiler(textOf(STANDARD), nameOf(STANDARD)));
  const doc = jsonOf(STANDARD);
  const numbered = Object.keys(doc.playthrough)
    .map(Number)
    .filter((sphere) => Number.isInteger(sphere) && sphere >= 1);

  it("is a real file with that sphere", () => {
    expect(doc.playthrough["0"]).toEqual({
      Equipped: { "Equipment Slot 1": "UncleSword:1" },
    });
  });

  it("reads it: the spheres are the numbered ones, the start is the Equipped section's", () => {
    expect(standard.spheres).toBe(Math.max(...numbered));
    expect(standard.start).toContain("Progressive Sword");
    expect(standard.placements.some((p) => p.sphere === 1)).toBe(true);
  });

  it("gives no location a sphere 0", () => {
    expect(standard.placements.every((p) => p.sphere !== 0)).toBe(true);
  });

  it("refuses a sphere 0 that is not the starting equipment", () => {
    for (const zero of [
      { "Light World": { "Hobo:1": "IceRod:1" } },
      { Equipped: { "Equipment Slot 1": "UncleSword:1" }, Other: {} },
      {},
    ]) {
      expect(
        refused(
          changed(STANDARD, (edit) => {
            edit.playthrough["0"] = zero;
          }),
        ),
      ).toEqual(["not-a-spoiler", "playthrough"]);
    }
  });

  it("still refuses a sphere below 0 or one that is not a number", () => {
    for (const key of ["-1", "x"]) {
      expect(
        refused(
          changed(STANDARD, (edit) => {
            edit.playthrough[key] = { "Light World": { "Hobo:1": "IceRod:1" } };
          }),
        ),
      ).toEqual(["not-a-spoiler", "playthrough"]);
    }
  });
});

describe("what it accepts", () => {
  it("reads a spoiler race's: placements, no playthrough", () => {
    const race = logOf(
      parseSpoiler(
        changed(VT, (doc) => {
          delete doc.playthrough;
          doc.meta.tournament = true;
        }),
        nameOf(VT),
      ),
    );
    expect(race.spheres).toBe(0);
    expect(race.placements).toHaveLength(230);
    expect(race.placements.every((p) => p.sphere === null)).toBe(true);
  });

  it("reads a file with no Special, Equipped, Shops or Bosses", () => {
    const bare = logOf(
      parseSpoiler(
        changed(VT, (doc) => {
          for (const key of ["Special", "Equipped", "Shops", "Bosses"]) {
            delete doc[key];
          }
        }),
        nameOf(VT),
      ),
    );
    expect(bare.placements).toHaveLength(226);
    expect(bare.start).toEqual([]);
    expect(bare.extra.shops).toEqual([]);
    expect(bare.extra.medallions).toEqual({ mire: null, turtleRock: null });
  });

  it("ignores a shop it cannot read, and a medallion it does not know", () => {
    const odd = logOf(
      parseSpoiler(
        changed(VT, (doc) => {
          doc.Shops = [{ item_0: 3, location: "Shop", type: "Shop" }, 7];
          doc.Special["Misery Mire Medallion:1"] = "Hammer:1";
        }),
        nameOf(VT),
      ),
    );
    expect(odd.extra.shops).toEqual([]);
    expect(odd.extra.medallions.mire).toBeNull();
    expect(odd.extra.medallions.turtleRock).toBe("ether");
  });
});

describe("never throws on the file", () => {
  const settled = (text: string, name?: string) => {
    const result = parseSpoiler(text, name);
    expect(typeof result.ok).toBe("boolean");
    if (!result.ok)
      expect((result.detail ?? "").length).toBeLessThanOrEqual(80);
  };

  it("on any text", () => {
    fc.assert(fc.property(fc.string({ unit: "binary" }), fc.string(), settled));
  });

  it("on any JSON", () => {
    fc.assert(
      fc.property(fc.jsonValue(), (value) =>
        settled(JSON.stringify(value), "x_9MQ9gO1wMD.txt"),
      ),
    );
    fc.assert(
      fc.property(
        fc.dictionary(fc.string(), fc.jsonValue()),
        fc.jsonValue(),
        (doc, meta) => settled(JSON.stringify({ ...doc, meta })),
      ),
    );
  });

  it("on a real file cut anywhere, or with a value replaced", () => {
    const text = textOf(ER);
    fc.assert(
      fc.property(fc.nat(text.length), (at) => settled(text.slice(0, at))),
    );
    fc.assert(
      fc.property(
        fc.nat(8),
        fc.jsonValue(),
        fc.constantFrom(VT, ER),
        (pick, value, hash) => {
          const doc = jsonOf(hash);
          const keys = Object.keys(doc);
          doc[keys[pick % keys.length] as string] = value;
          settled(JSON.stringify(doc));
        },
      ),
    );
  });
});
