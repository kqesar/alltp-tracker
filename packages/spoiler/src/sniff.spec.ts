import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { sniffSpoiler } from "./sniff";

// Heads of real files: alttpr.com's Save Spoiler (vt, then entrance
// randomizer), its S3 seed file, Map Rando's spoiler.json and samus.link's
// Download and API.
const VT =
  '{\n    "meta": {\n        "goal": "ganon",\n        "mode": "open",\n        "size": 2,';
const ER =
  '{\n    "meta": {\n        "goal": "ganon",\n        "shuffle": "crossed",\n        "version": "0.6.3-pre",';
const S3 =
  '{"logic":31,"patch":[{"20512":[49]},{"20735":[144]},{"20958":[0]},{"32704":[86,84,32]}';
const MAP_RANDO =
  '{"item_priority":["ReserveTank","PowerBomb"],"missile_size":5,"super_size":5,"powerbomb_size":5,"summary":[{"step":1,"flags":[],"doors":[],"items":[{"item":"Morph"';
const SMZ3_DOWNLOAD =
  "- SMZ3 11.3.2 KAGO KAGO RINKA BABUSU\n- Playthrough:\n  - Sphere 1:\n      Kakariko Well - Middle: Bug Catching Net";
const SMZ3_SERVER_YAML =
  "Game: SMZ3 11.3.2 KAGO KAGO RINKA BABUSU\nMeta:\n  guid: 8506bbef2c2b4432af378b571c6c9133";
const SMZ3_API =
  '{"seed":{"id":512493,"guid":"8506bbef2c2b4432af378b571c6c9133","mode":"normal","seedNumber":"735071189","spoiler":"[{\\"Kakariko Well - Middle\\"';
const SMZ3_API_SM = '{"seed":{"id":1,"guid":"x","gameId":"sm","spoiler":"[]"}}';
const SM_YAML = "- SM 11.3.2 AAAA BBBB CCCC\n- Playthrough:";
const ARCHIPELAGO =
  "Archipelago Version 0.6.8  -  Seed: 123456\n\nFilling Algorithm:  balanced";
// The Door Randomizer's text log, as SahasrahBot posts it for a spoiler race,
// and its Overworld fork's first line (OWR 0.8.0.0 BaseClasses.py:3335)
const DR_TEXT =
  "ALttP Dungeon Randomizer Version 1.5.6-u  -  Seed: 660701088\n\nHash: Powder, Key, Bottle, Compass, Pearl";
const OWR_TEXT =
  "ALttP Overworld Randomizer  -  Seed: 660701088\n\nDoor Version:                      1.5.6";
// DR's Spoiler.to_json: json.dumps of its lists first (BaseClasses.py:2718-2725)
const DR_JSON =
  '{"Entrances": [], "Doors": [{"player": 1, "entrance": "Hyrule Castle Lobby W"';

describe("sniffSpoiler", () => {
  it.each([
    ["alttpr.com vt", VT, "", "alttpr", null],
    ["alttpr.com entrance randomizer", ER, "", "alttpr", null],
    ["alttpr.com S3 seed file", S3, "9MQ9gO1wMD.json", "alttpr", null],
    ["Map Rando", MAP_RANDO, "spoiler.json", "sm", "map-rando"],
    [
      "samus.link Download",
      SMZ3_DOWNLOAD,
      "x - Spoiler.txt",
      "smz3",
      "smz3-yaml",
    ],
    ["samus.link server YAML", SMZ3_SERVER_YAML, "", "smz3", "smz3-yaml"],
    ["samus.link API", SMZ3_API, "spoiler.json", "smz3", "smz3-api"],
    [
      "Door Randomizer text",
      DR_TEXT,
      "DR_660701088_Spoiler.txt",
      "alttpr",
      "dr",
    ],
    ["Overworld Randomizer text", OWR_TEXT, "", "alttpr", "dr"],
    ["Door Randomizer JSON", DR_JSON, "", "alttpr", "dr"],
    [
      "avianart's Download Spoiler",
      '{\n    "Entrances": [\n        {',
      "alttprcustom - DR__C2BdrZOiV_Spoiler.txt",
      "alttpr",
      "dr",
    ],
  ] as const)("%s", (_name, head, fileName, game, format) => {
    expect(sniffSpoiler(head, fileName)).toEqual({ format, game, known: true });
  });

  it("reads past a byte order mark and leading whitespace", () => {
    expect(sniffSpoiler(`﻿  \n${VT}`)).toMatchObject({
      game: "alttpr",
      known: true,
    });
    expect(sniffSpoiler(`﻿${SMZ3_DOWNLOAD}`)).toMatchObject({
      game: "smz3",
      known: true,
    });
  });

  it("tells a Map Rando log by its summary alone", () => {
    expect(sniffSpoiler('{"summary":[{"step":1,"items":[]}]}')).toMatchObject({
      game: "sm",
    });
  });

  it("takes an alttpr.com file name for a JSON of unknown head", () => {
    expect(
      sniffSpoiler('{"x": 1}', "alttpr - mystery_xvJo0drkyJ.txt"),
    ).toMatchObject({
      game: "alttpr",
      known: true,
    });
    expect(sniffSpoiler('{"x": 1}', "other.txt")).toEqual({
      known: false,
      what: "unknown",
    });
  });

  it("tells a Door Randomizer JSON by a DR key or a DR file name, not by its lists alone", () => {
    expect(sniffSpoiler('{"Entrances": [], "Lobbies": []}')).toMatchObject({
      format: "dr",
    });
    // alttpr.com's entrance randomizer writes an Entrances list too
    expect(sniffSpoiler('{"Entrances": [{"entrance": "Link\'s House"')).toEqual(
      { known: false, what: "unknown" },
    );
    expect(sniffSpoiler('{"x": 1}', "OR_1234_Spoiler.json")).toMatchObject({
      format: "dr",
    });
    // A text log is told by its first line, not by a name
    expect(sniffSpoiler("Seed: 1", "DR_1_Spoiler.txt")).toEqual({
      known: false,
      what: "unknown",
    });
  });

  it("names the randomizers it does not read", () => {
    expect(sniffSpoiler(ARCHIPELAGO)).toEqual({
      known: false,
      what: "archipelago",
    });
    expect(sniffSpoiler(SM_YAML)).toEqual({ known: false, what: "smz3-sm" });
    expect(sniffSpoiler(SMZ3_API_SM)).toEqual({
      known: false,
      what: "smz3-sm",
    });
  });

  it("calls a binary or a ROM name a rom", () => {
    expect(sniffSpoiler("\0\u0001\u0002")).toEqual({
      known: false,
      what: "rom",
    });
    expect(sniffSpoiler("��J�")).toEqual({ known: false, what: "rom" });
    expect(sniffSpoiler(VT, "alttpr - x_9MQ9gO1wMD.sfc")).toEqual({
      known: false,
      what: "rom",
    });
    expect(sniffSpoiler("", "seed.SMC")).toEqual({ known: false, what: "rom" });
  });

  it("leaves anything else unknown", () => {
    for (const head of [
      "",
      "hello",
      "[1, 2]",
      "<html>",
      "{}",
      "key: value\n",
    ]) {
      expect(sniffSpoiler(head)).toEqual({ known: false, what: "unknown" });
    }
  });

  it("never throws", () => {
    fc.assert(
      fc.property(fc.string({ unit: "binary" }), fc.string(), (head, name) => {
        expect(() => sniffSpoiler(head, name)).not.toThrow();
      }),
    );
  });
});
