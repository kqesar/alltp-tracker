// The margin world: basic placement's health gates, and only those, are
// passed by `basicMargin`; at 0 it reads as the real world.
import { parse, type State, solve } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { BOSSES } from "./bosses";
import { everything } from "./keys";
import {
  compileMargin,
  isMarginGate,
  MARGIN_ITEM,
  MARGIN_STATE,
  marginModules,
  marginRequirement,
} from "./margin";
import { compile, regionModules } from "./pack";
import { type AlttprSettings, settingsFromUpstream } from "./settings";
import type { RegionModule } from "./world";

const placed = (mode: "open" | "standard" | "inverted", basic: boolean) =>
  settingsFromUpstream(mode, {
    goal: "ganon",
    itemPlacement: basic ? "basic" : "advanced",
  });

const OPEN_BASIC = placed("open", true);
const OPEN_ADVANCED = placed("open", false);

/** Each rule of a world, by where it is read: a location or an entrance. */
const rulesOf = (modules: readonly RegionModule[]): Map<string, string> =>
  new Map(
    modules.flatMap((m) =>
      m.regions.flatMap((r) => [
        ...r.entrances.map((e) => [`${r.id} <- ${e.from}`, e.req] as const),
        ...r.locations.map((l) => [l.id, l.req] as const),
      ]),
    ),
  );

/** Where the margin world reads another rule than the real one. */
const relaxed = (settings: AlttprSettings): string[] => {
  const real = rulesOf(regionModules(settings));
  return [...rulesOf(marginModules(settings))]
    .filter(([where, req]) => real.get(where) !== req)
    .map(([where]) => where)
    .sort();
};

/** Everything held but Link's health: 8 hearts found, 11 on screen. */
const elevenHearts = (settings: AlttprSettings): State => ({
  ...everything(settings),
  heartContainer: 8,
  pieceOfHeart: 0,
});

describe("marginRequirement", () => {
  it("adds the margin to a health gate and leaves the rest of the rule", () => {
    expect(
      marginRequirement(
        "rescueZelda & (!setting(basicPlacement) | (setting(swordless) | @hasSword2) & @hasHealth12 & (@hasBottle2 | @hasArmor)) & (!setting(basicPlacement) & pegasusBoots | hookshot)",
      ),
    ).toBe(
      "rescueZelda & (!setting(basicPlacement) | (setting(swordless) | @hasSword2) & @hasHealth12 & (@hasBottle2 | @hasArmor) | basicMargin) & (!setting(basicPlacement) & pegasusBoots | hookshot)",
    );
  });

  it("leaves the placement rules that read no health as they are", () => {
    for (const req of [
      // Ganon's Tower's torches (GanonsTower.php:282)
      "(hammer & hookshot | fireRod & caneOfSomaria) & keyA2 >= 3 & (!setting(basicPlacement) | fireRod | ether & @hasSword)",
      // Turtle Rock's laser bridge, the Pegasus Boots for a hookshot gap
      "!setting(basicPlacement) | cape | caneOfByrna",
      "hookshot | !setting(basicPlacement) & pegasusBoots",
      // The Book of Mudora at the Pedestal
      "(!setting(basicPlacement) | bookOfMudora) & pendantOfPower",
      ...Object.values(BOSSES).map(({ req }) => req),
    ]) {
      expect(marginRequirement(req)).toBe(req);
    }
  });

  it("finds no gate in a rule that reads health without basic placement", () => {
    expect(isMarginGate(parse("@hasHealth7 | hookshot"))).toBe(false);
  });
});

/** The regions whose way in the margin world reads another way. */
const GATED = [
  "ganonsTower",
  "icePalace",
  "miseryMire",
  "palaceOfDarkness",
  "skullWoods",
  "swampPalace",
  "thievesTown",
  "turtleRock",
];

describe("the margin world", () => {
  it.each([
    ["Open", "open"],
    ["Standard", "standard"],
    ["Inverted", "inverted"],
  ] as const)(
    "relaxes the ways into the dark world's dungeons alone, in %s",
    (_, mode) => {
      const sites = relaxed(placed(mode, true));
      // Only entrances: no location's own rule moves
      expect(sites.every((where) => where.includes(" <- "))).toBe(true);
      expect([
        ...new Set(sites.map((where) => where.split(" <- ")[0])),
      ]).toEqual(GATED);
    },
  );

  const tri = (settings: AlttprSettings, state: State, id: string) => ({
    margin: solve(compileMargin(settings), {
      ...state,
      ...MARGIN_STATE,
    }).location(id),
    real: solve(compile(settings), state).location(id),
  });

  it("opens Misery Mire and Turtle Rock to 11 hearts, the margin dropped", () => {
    const state = elevenHearts(OPEN_BASIC);
    for (const id of ["misery-mire/big-chest", "turtle-rock/compass-chest"]) {
      expect(tri(OPEN_BASIC, state, id)).toEqual({ margin: "yes", real: "no" });
    }
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

  it("reads as the real world with the margin not held", () => {
    for (const settings of [OPEN_BASIC, OPEN_ADVANCED]) {
      const state = elevenHearts(settings);
      const real = solve(compile(settings), state).locations();
      expect(solve(compileMargin(settings), state).locations()).toEqual(real);
      expect(
        solve(compileMargin(settings), {
          ...state,
          [MARGIN_ITEM]: 0,
        }).locations(),
      ).toEqual(real);
    }
  });

  it("moves nothing in an advanced run", () => {
    const state = elevenHearts(OPEN_ADVANCED);
    expect(
      solve(compileMargin(OPEN_ADVANCED), {
        ...state,
        ...MARGIN_STATE,
      }).locations(),
    ).toEqual(solve(compile(OPEN_ADVANCED), state).locations());
  });

  it("keeps the dark rooms' lamp and Ganon's Tower's torches", () => {
    const state = {
      ...elevenHearts(OPEN_BASIC),
      ether: 0,
      fireRod: 0,
      lamp: 0,
    };
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
