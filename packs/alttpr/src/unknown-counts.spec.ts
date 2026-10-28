// Counts a tracker may not know: read as maybe while unknown, as upstream
// writes them once known.
import { evaluate, loadRules, parse } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { filler } from "./fill";
import { solveWithKeys } from "./keys";
import { compile } from "./pack";
import { RULES } from "./rules";
import { settingsFromUpstream } from "./settings";
import { EMPTY_INPUT, type TrackerInput, toState } from "./tracker";
import {
  type CountKnowledge,
  UNKNOWN_COUNT_FACTS,
  unknownCountFacts,
  unknownCountRequirement,
} from "./unknown-counts";

const BASIC = settingsFromUpstream("open", { itemPlacement: "basic" });
const ADVANCED = settingsFromUpstream("open", {});
const SHOOTER_ROOM = "palace-of-darkness/shooter-room";

/** Agahnim beaten, a sword, a bottle and the pearl: PoD's way in. */
const atPalace = (
  items: TrackerInput["items"],
  unknown?: CountKnowledge,
): TrackerInput => ({
  ...EMPTY_INPUT,
  beaten: { "castle-tower": true },
  items: { bottle: 1, moonPearl: 1, sword: 1, ...items },
  ...(unknown === undefined ? {} : { unknown }),
});

const shooterRoom = (input: TrackerInput, settings = BASIC) =>
  solveWithKeys(
    filler(compile(settings), settings),
    toState(input, settings),
  ).locations()[SHOOTER_ROOM];

describe("unknownCountRequirement", () => {
  it("pairs each atom of an item not known with its fact", () => {
    expect(
      unknownCountRequirement(
        "heartContainer >= 6 & pieceOfHeart >= 4 | hammer",
      ),
    ).toBe(
      "(heartContainer >= 6 | healthUnknown & maybe) & (pieceOfHeart >= 4 | healthUnknown & maybe) | hammer",
    );
    expect(unknownCountRequirement("sword | tenBombs")).toBe(
      "sword | tenBombs | bombsUnknown & maybe",
    );
  });

  it("leaves a rule that reads none of them as it is", () => {
    const req = "hammer & @canLiftRocks | count(crystal) >= 7";
    expect(unknownCountRequirement(req)).toBe(req);
  });

  it("reads upstream's rule once the count is known, and maybe at most while not", () => {
    const rules = loadRules(RULES);
    const health = parse("@hasHealth7");
    const read = (state: Record<string, number>) =>
      evaluate(health, state, rules);
    expect(read({ heartContainer: 7 })).toBe("yes");
    expect(read({ heartContainer: 6, pieceOfHeart: 3 })).toBe("no");
    expect(read({ healthUnknown: 1 })).toBe("maybe");
    expect(read({ healthUnknown: 1, heartContainer: 7 })).toBe("yes");
  });
});

describe("unknownCountFacts", () => {
  it("holds the fact of each count not known, and no other", () => {
    expect(unknownCountFacts({ health: true })).toEqual({ healthUnknown: 1 });
    expect(unknownCountFacts({ bombs: true, health: false })).toEqual({
      bombsUnknown: 1,
    });
    expect(unknownCountFacts({})).toEqual({});
    expect(UNKNOWN_COUNT_FACTS).toEqual(["bombsUnknown", "healthUnknown"]);
  });
});

describe("the basic placement's dungeon gate", () => {
  it("is maybe while the health is not known, never out of logic", () => {
    expect(shooterRoom(atPalace({}, { health: true }))).toBe("maybe");
  });

  it("reads the hearts found once known: 7 open it, 6 and three pieces do not", () => {
    expect(shooterRoom(atPalace({ heartContainer: 7 }))).toBe("yes");
    expect(shooterRoom(atPalace({ heartContainer: 6, pieceOfHeart: 3 }))).toBe(
      "no",
    );
    expect(
      shooterRoom(
        atPalace({ heartContainer: 6, pieceOfHeart: 4 }, { health: false }),
      ),
    ).toBe("yes");
  });

  it("asks for no hearts with the advanced placement", () => {
    expect(shooterRoom(atPalace({}), ADVANCED)).toBe("yes");
    expect(shooterRoom(atPalace({}, { health: true }), ADVANCED)).toBe("yes");
  });
});
