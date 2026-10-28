// The margin world: basic placement's safety margins, and only those, are
// passed by their items; with none held it reads as the real world.
import { parse, type State, solve } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { BOSSES } from "./bosses";
import { everything } from "./keys";
import {
  compileMargin,
  isHealthGate,
  MARGIN_GATES,
  MARGIN_ITEMS,
  MARGIN_RULES,
  MARGIN_STATE,
  type MarginGateId,
  marginModules,
  marginRequirement,
} from "./margin";
import { compile, regionModules } from "./pack";
import { RULES } from "./rules";
import { type AlttprSettings, settingsFromUpstream } from "./settings";
import type { RegionModule } from "./world";

const placed = (
  mode: "open" | "standard" | "inverted",
  basic: boolean,
  weapons?: "swordless",
) =>
  settingsFromUpstream(mode, {
    goal: "ganon",
    itemPlacement: basic ? "basic" : "advanced",
    ...(weapons === undefined ? {} : { "mode.weapons": weapons }),
  });

const OPEN_BASIC = placed("open", true);
const OPEN_ADVANCED = placed("open", false);

/** Each rule of a world, where it is read, with its upstream source. */
const rulesOf = (
  modules: readonly RegionModule[],
): Map<string, { req: string; source: string }> =>
  new Map(
    modules.flatMap((m) =>
      m.regions.flatMap((r) => [
        ...r.entrances.map(
          (e) =>
            [`${r.id} <- ${e.from}`, { req: e.req, source: e.source }] as const,
        ),
        ...r.locations.map(
          (l) => [l.id, { req: l.req, source: l.source ?? "" }] as const,
        ),
      ]),
    ),
  );

/**
 * Where the margin world reads another rule than the real one, with the
 * upstream source of the rule and the margins it reads.
 */
const relaxed = (settings: AlttprSettings): string[] => {
  const real = rulesOf(regionModules(settings));
  return [...rulesOf(marginModules(settings))]
    .filter(([where, { req }]) => real.get(where)?.req !== req)
    .map(
      ([where, { req, source }]) =>
        `${where} (${source}): ${MARGIN_ITEMS.filter((item) => new RegExp(`\\b${item}\\b`).test(req)).join(", ")}`,
    )
    .sort();
};

/** Everything held but Link's health: 8 hearts found, 11 on screen. */
const elevenHearts = (settings: AlttprSettings): State => ({
  ...everything(settings),
  heartContainer: 8,
  pieceOfHeart: 0,
});

/** The margin world solved with one margin dropped, and the real world. */
const tri = (
  settings: AlttprSettings,
  state: State,
  id: string,
  gate?: MarginGateId,
) => ({
  margin: solve(compileMargin(settings), {
    ...state,
    ...(gate === undefined ? MARGIN_STATE : { [MARGIN_GATES[gate].item]: 1 }),
  }).location(id),
  real: solve(compile(settings), state).location(id),
});

describe("marginRequirement", () => {
  it("adds the dungeon's margin to its health gate, and nothing else", () => {
    expect(
      marginRequirement(
        "rescueZelda & (!setting(basicPlacement) | (setting(swordless) | @hasSword2) & @hasHealth12 & (@hasBottle2 | @hasArmor)) & (!setting(basicPlacement) & pegasusBoots | hookshot)",
        { region: "miseryMire" },
      ),
    ).toBe(
      "rescueZelda & (!setting(basicPlacement) | (setting(swordless) | @hasSword2) & @hasHealth12 & (@hasBottle2 | @hasArmor) | marginMiseryMire) & (!setting(basicPlacement) & pegasusBoots | hookshot)",
    );
  });

  it("refuses a health gate in a region that is no gated dungeon", () => {
    expect(() =>
      marginRequirement("!setting(basicPlacement) | @hasHealth7", {
        region: "easternPalace",
      }),
    ).toThrow(RangeError);
  });

  it("gives a boss's rule its margin, Helmasaur King's branch included", () => {
    expect(
      marginRequirement(BOSSES.canBeatHelmasaurKing.req, {
        helper: "canBeatHelmasaurKing",
      }),
    ).toBe(
      "(@canBombThings | hammer) & (@hasSword2 | @canShootArrows | (!setting(basicPlacement) | marginHelmasaurKing) & @hasSword)",
    );
  });

  it("gives Ganon's better sword its margin, and the silvers only with a sword", () => {
    expect(
      marginRequirement(
        "(!setting(requireBetterBow) | @canShootArrows2) & (!setting(requireBetterSword) & @hasSword2 | @hasSword3)",
        { region: "northEastDarkWorld" },
      ),
    ).toBe(
      "(!setting(requireBetterBow) | !setting(swordless) & marginGanon | @canShootArrows2) & ((!setting(requireBetterSword) | marginGanon) & @hasSword2 | @hasSword3)",
    );
  });

  it("leaves what is not a margin as it is, wherever it sits", () => {
    for (const req of [
      // Ganon's Tower's torches (GanonsTower.php:282)
      "(hammer & hookshot | fireRod & caneOfSomaria) & keyA2 >= 3 & (!setting(basicPlacement) | fireRod | ether & @hasSword)",
      // Turtle Rock's laser bridge, the Pegasus Boots for a hookshot gap
      "!setting(basicPlacement) | cape | caneOfByrna",
      "hookshot | !setting(basicPlacement) & pegasusBoots",
      // The Book of Mudora at the Pedestal
      "(!setting(basicPlacement) | bookOfMudora) & pendantOfPower",
    ]) {
      expect(marginRequirement(req, { region: "turtleRock" })).toBe(req);
    }
    expect(isHealthGate(parse("@hasHealth7 | hookshot"))).toBe(false);
  });
});

describe("the margin world", () => {
  /**
   * Every rule it relaxes, pinned with its upstream source: the eight
   * dungeons' ways in (their health gates) and Ganon's better sword and
   * silvers. What else basic placement asks (Turtle Rock's laser bridge,
   * the Boots for a gap, Ganon's Tower's torches, the Book at the Pedestal,
   * the Mirror for the smith, the Hookshot at the Bumper Cave, Ice Palace's
   * keys) is not among them.
   */
  const STANDARD_SITES = [
    "ganon (app/Region/Standard/DarkWorld/NorthEast.php:186): marginGanon",
    "ganonsTower <- eastDarkWorldDeathMountain (app/Region/Standard/GanonsTower.php:401): marginGanonsTower",
    "ganonsTower <- start (app/Region/Standard/GanonsTower.php:413): marginGanonsTower",
    "ganonsTower <- westDarkWorldDeathMountain (app/Region/Standard/GanonsTower.php:409): marginGanonsTower",
    "icePalace <- southDarkWorld (app/Region/Standard/IcePalace.php:140): marginIcePalace",
    "icePalace <- start (app/Region/Standard/IcePalace.php:137): marginIcePalace",
    "miseryMire <- mire (app/Region/Standard/MiseryMire.php:132): marginMiseryMire",
    "palaceOfDarkness <- northEastDarkWorld (app/Region/Standard/PalaceOfDarkness.php:186): marginPalaceOfDarkness",
    "palaceOfDarkness <- westDeathMountain (app/Region/Standard/PalaceOfDarkness.php:190): marginPalaceOfDarkness",
    "skullWoods <- northWestDarkWorld (app/Region/Standard/SkullWoods.php:153): marginSkullWoods",
    "swampPalace <- southDarkWorld (app/Region/Standard/SwampPalace.php:177): marginSwampPalace",
    "thievesTown <- northWestDarkWorld (app/Region/Standard/ThievesTown.php:118): marginThievesTown",
    "turtleRock <- turtleRockLower (app/Region/Standard/TurtleRock.php:261): marginTurtleRock",
    "turtleRock <- turtleRockMiddle (app/Region/Standard/TurtleRock.php:262): marginTurtleRock",
    "turtleRock <- turtleRockUpper (app/Region/Standard/TurtleRock.php:263): marginTurtleRock",
  ];

  it.each([
    ["Open", "open"],
    ["Standard", "standard"],
  ] as const)("relaxes these rules alone in %s", (_, mode) => {
    expect(relaxed(placed(mode, true))).toEqual(STANDARD_SITES);
  });

  it("relaxes the same rules in Inverted's regions", () => {
    expect(relaxed(placed("inverted", true))).toEqual([
      "ganon (app/Region/Inverted/LightWorld/NorthEast.php:144): marginGanon",
      "ganonsTower <- northEastLightWorld (app/Region/Inverted/GanonsTower.php:467): marginGanonsTower",
      "icePalace <- northWestDarkWorld (app/Region/Inverted/IcePalace.php:33): marginIcePalace",
      "icePalace <- start (app/Region/Inverted/IcePalace.php:23): marginIcePalace",
      "miseryMire <- mire (app/Region/Inverted/MiseryMire.php:24): marginMiseryMire",
      "palaceOfDarkness <- northEastDarkWorld (app/Region/Inverted/PalaceOfDarkness.php:29): marginPalaceOfDarkness",
      "palaceOfDarkness <- start (app/Region/Inverted/PalaceOfDarkness.php:30): marginPalaceOfDarkness",
      "skullWoods <- northWestDarkWorld (app/Region/Inverted/SkullWoods.php:43): marginSkullWoods",
      "swampPalace <- southLightWorld (app/Region/Inverted/SwampPalace.php:133): marginSwampPalace",
      "thievesTown <- northWestDarkWorld (app/Region/Inverted/ThievesTown.php:23): marginThievesTown",
      "turtleRock <- turtleRockLower (app/Region/Inverted/TurtleRock.php:211): marginTurtleRock",
      "turtleRock <- turtleRockMiddle (app/Region/Inverted/TurtleRock.php:210): marginTurtleRock",
      "turtleRock <- turtleRockUpper (app/Region/Inverted/TurtleRock.php:209): marginTurtleRock",
    ]);
  });

  it("relaxes the seven bosses' weapons alone among the named rules", () => {
    const helpers = RULES.helpers ?? {};
    const changed = Object.entries(MARGIN_RULES.helpers ?? {})
      .filter(([name, req]) => helpers[name] !== req)
      .map(([name]) => name)
      .sort();
    expect(changed).toEqual([
      "canBeatArrghus",
      "canBeatBlind",
      "canBeatHelmasaurKing",
      "canBeatKholdstare",
      "canBeatMothula",
      "canBeatTrinexx",
      "canBeatVitreous",
    ]);
    // Each from Boss.php, at the line its gate says
    for (const name of changed) {
      const gate = Object.values(MARGIN_GATES).find(
        (each) => each.kind === "boss" && each.rule === name,
      );
      expect(gate?.source).toBe(BOSSES[name as keyof typeof BOSSES].source);
    }
  });

  it("opens Misery Mire and Turtle Rock to 11 hearts, their margins dropped", () => {
    const state = elevenHearts(OPEN_BASIC);
    expect(
      tri(OPEN_BASIC, state, "misery-mire/big-chest", "miseryMire"),
    ).toEqual({ margin: "yes", real: "no" });
    // Another dungeon's margin does not open it
    expect(
      tri(OPEN_BASIC, state, "misery-mire/big-chest", "turtleRock"),
    ).toEqual({ margin: "no", real: "no" });
    expect(tri(OPEN_BASIC, state, "turtle-rock/compass-chest")).toEqual({
      margin: "yes",
      real: "no",
    });
  });

  it("reads 15 hearts in logic, and the margin moves nothing then", () => {
    const state = {
      ...elevenHearts(OPEN_BASIC),
      heartContainer: 11,
      pieceOfHeart: 4,
    };
    expect(tri(OPEN_BASIC, state, "misery-mire/big-chest")).toEqual({
      margin: "yes",
      real: "yes",
    });
  });

  it("beats a boss with the weapon the advanced placement asks", () => {
    // The Fighter's Sword, no magic: Kholdstare wants the Master Sword
    const state = { ...everything(OPEN_BASIC), bottle: 0, magic: 0, sword: 1 };
    expect(tri(OPEN_BASIC, state, "ice-palace/boss")).toEqual({
      margin: "yes",
      real: "no",
    });
    // Ice Palace's way in wants the Master Sword too: both margins it is
    expect(tri(OPEN_BASIC, state, "ice-palace/boss", "kholdstare")).toEqual({
      margin: "no",
      real: "no",
    });
    expect(
      solve(compileMargin(OPEN_BASIC), {
        ...state,
        [MARGIN_GATES.icePalace.item]: 1,
        [MARGIN_GATES.kholdstare.item]: 1,
      }).location("ice-palace/boss"),
    ).toBe("yes");
  });

  it("beats Ganon with the Master Sword, and swordless still wants the silvers", () => {
    const masterSword = { ...everything(OPEN_BASIC), sword: 2 };
    expect(tri(OPEN_BASIC, masterSword, "ganon", "ganon")).toEqual({
      margin: "yes",
      real: "no",
    });
    const noSilvers = {
      ...everything(OPEN_BASIC),
      bow: 1,
      silverArrowUpgrade: 0,
    };
    expect(tri(OPEN_BASIC, noSilvers, "ganon", "ganon")).toEqual({
      margin: "yes",
      real: "no",
    });
    const swordless = placed("open", true, "swordless");
    const swordlessNoSilvers = {
      ...everything(swordless),
      bow: 1,
      silverArrowUpgrade: 0,
    };
    expect(tri(swordless, swordlessNoSilvers, "ganon")).toEqual({
      margin: "no",
      real: "no",
    });
  });

  it("reads as the real world with no margin held", () => {
    for (const settings of [OPEN_BASIC, OPEN_ADVANCED]) {
      const state = elevenHearts(settings);
      const real = solve(compile(settings), state).locations();
      expect(solve(compileMargin(settings), state).locations()).toEqual(real);
    }
  });

  it("moves nothing in an advanced run", () => {
    const state = { ...elevenHearts(OPEN_ADVANCED), sword: 1 };
    expect(
      solve(compileMargin(OPEN_ADVANCED), {
        ...state,
        ...MARGIN_STATE,
      }).locations(),
    ).toEqual(solve(compile(OPEN_ADVANCED), state).locations());
  });

  it("keeps the laser bridge, the dark rooms' lamp and Ganon's Tower's torches", () => {
    const state = {
      ...elevenHearts(OPEN_BASIC),
      caneOfByrna: 0,
      cape: 0,
      ether: 0,
      fireRod: 0,
      lamp: 0,
      shield: 2,
    };
    // The laser bridge: the Cape, Byrna or the Mirror Shield, kept
    expect(
      tri(
        OPEN_BASIC,
        { ...state, lamp: 1 },
        "turtle-rock/eye-bridge/bottom-left",
      ),
    ).toEqual({ margin: "no", real: "no" });
    expect(
      tri(
        OPEN_BASIC,
        { ...state, cape: 1, lamp: 1 },
        "turtle-rock/eye-bridge/bottom-left",
      ),
    ).toEqual({ margin: "maybe", real: "no" }); // a key may sit behind it
    // Dark rooms: the lamp is no part of the margin
    expect(tri(OPEN_BASIC, state, "palace-of-darkness/dark-maze/top")).toEqual({
      margin: "no",
      real: "no",
    });
    // Basic placement lights Bob's torches with the Fire Rod or Ether
    expect(tri(OPEN_BASIC, state, "ganons-tower/bobs-chest")).toEqual({
      margin: "no",
      real: "no",
    });
    expect(tri(OPEN_BASIC, state, "ganons-tower/hope-room/right")).toEqual({
      margin: "yes",
      real: "no",
    });
  });
});
