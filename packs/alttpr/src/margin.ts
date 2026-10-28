// Basic placement's safety margins, each an item a state may hold: the world
// in which the tracker asks what a run could do but for them.
//
// Read from sporchia/alttp_vt_randomizer at 219fcafd (LOGIC 31), as the
// pack ports it. Basic item placement adds clauses to rules that the
// advanced placement does without. A clause that the advanced placement
// reads as in logic is no wall: a player can do the place without it, and
// the generator only promises not to need it before Link has it. Those
// that ask Link to be able to take a beating or to hit harder are the
// margins here, one item each (`MARGIN_GATES`):
//
// - a dungeon's way in: a sword (or a swordless run), 7 hearts found and a
//   bottle before Palace of Darkness, Swamp Palace, Skull Woods and
//   Thieves' Town; the Master Sword, 12 hearts found and two bottles or a
//   mail before Ice Palace, Misery Mire, Turtle Rock and Ganon's Tower
//   (`itemPlacement !== 'basic' || …hasHealth(n)…`, SwampPalace.php:177,
//   MiseryMire.php:132 and the others, Inverted's alike): the clause, an
//   `or` with `!setting(basicPlacement)` beside an argument reading
//   `@hasHealth…`, gains the dungeon's item;
// - a boss's weapon: Helmasaur King, Arrghus, Mothula, Blind, Kholdstare,
//   Vitreous and Trinexx ask basic placement for a better sword (or arrows,
//   magic and the Fire Rod; Blind a sword with the Cape or the Cane of
//   Byrna) on top of what beats them (Boss.php:86-123): every
//   `!setting(basicPlacement)` of the boss's rule reads `|` its item;
// - Turtle Rock's laser bridge: basic placement asks the Cape, the Cane of
//   Byrna or the Mirror Shield against the lasers (TurtleRock.php:192-222,
//   Inverted's alike), which the advanced placement does without: the
//   clause, an `or` with `!setting(basicPlacement)` beside `cape`, gains
//   `marginLaserBridge`;
// - Ganon: basic placement asks the Tempered Sword where the Master Sword
//   does (`region.requireBetterSword`) and the silver arrows
//   (`region.requireBetterBow`, World.php:261-267; DarkWorld/NorthEast.php:
//   227-232): `!setting(requireBetterSword)` reads `| marginGanon`, and
//   `!setting(requireBetterBow)` `| !setting(swordless) & marginGanon`,
//   since a swordless run asks the silvers whatever the placement
//   (World.php:269-273).
//
// With every item at 0 the world reads as the real one; with one at 1, as
// the real one without that margin. What is not a margin stays as it is:
// those clauses ask the player to get through, or to know less, not to be
// sturdier. The Pegasus Boots for a gap the
// Hookshot crosses (Misery Mire, Ganon's Tower, the Hookshot Cave), Ganon's
// Tower's torches (the Fire Rod or Ether), the Book of Mudora at the
// Pedestal, the Magic Mirror to bring the smith back, the Hookshot at the
// Bumper Cave, Ice Palace's keys with the Cane of Somaria, and Skull
// Woods's forced key (a fill rule).
import { type Expr, parse, print, walk } from "@alltp/engine";
import type { DungeonId } from "./dungeons";
import type { Source } from "./location";
import { type RuleSite, rewrittenWorld } from "./rewritten";

/** A margin basic placement keeps, and where upstream sets it. */
export type MarginGate =
  /** A dungeon's way in: Link's health, a sword and bottles or a mail. */
  | {
      readonly kind: "dungeon";
      readonly dungeon: DungeonId;
      readonly item: string;
      readonly source: Source;
    }
  /** A boss's weapon. */
  | {
      readonly kind: "boss";
      readonly boss: string;
      readonly rule: string;
      readonly item: string;
      readonly source: Source;
    }
  /** Ganon's better sword and silver arrows. */
  | { readonly kind: "ganon"; readonly item: string; readonly source: Source }
  /** Turtle Rock's laser bridge: the Cape, Byrna or the Mirror Shield. */
  | {
      readonly kind: "laserBridge";
      readonly item: string;
      readonly source: Source;
    };

const dungeonGate = (dungeon: DungeonId, item: string, source: Source) =>
  ({ dungeon, item, kind: "dungeon", source }) as const;
const bossGate = (boss: string, rule: string, item: string, line: number) =>
  ({ boss, item, kind: "boss", rule, source: `app/Boss.php:${line}` }) as const;

/** Every margin, by id: a dungeon region's, a boss rule's, or Ganon. */
export const MARGIN_GATES = {
  arrghus: bossGate("Arrghus", "canBeatArrghus", "marginArrghus", 91),
  blind: bossGate("Blind", "canBeatBlind", "marginBlind", 103),
  ganon: {
    item: "marginGanon",
    kind: "ganon",
    source: "app/World.php:261",
  },
  ganonsTower: dungeonGate(
    "ganons-tower",
    "marginGanonsTower",
    "app/Region/Standard/GanonsTower.php:401",
  ),
  helmasaurKing: bossGate(
    "Helmasaur King",
    "canBeatHelmasaurKing",
    "marginHelmasaurKing",
    86,
  ),
  icePalace: dungeonGate(
    "ice-palace",
    "marginIcePalace",
    "app/Region/Standard/IcePalace.php:137",
  ),
  kholdstare: bossGate(
    "Kholdstare",
    "canBeatKholdstare",
    "marginKholdstare",
    108,
  ),
  laserBridge: {
    item: "marginLaserBridge",
    kind: "laserBridge",
    source: "app/Region/Standard/TurtleRock.php:192",
  },
  miseryMire: dungeonGate(
    "misery-mire",
    "marginMiseryMire",
    "app/Region/Standard/MiseryMire.php:132",
  ),
  mothula: bossGate("Mothula", "canBeatMothula", "marginMothula", 96),
  palaceOfDarkness: dungeonGate(
    "palace-of-darkness",
    "marginPalaceOfDarkness",
    "app/Region/Standard/PalaceOfDarkness.php:186",
  ),
  skullWoods: dungeonGate(
    "skull-woods",
    "marginSkullWoods",
    "app/Region/Standard/SkullWoods.php:153",
  ),
  swampPalace: dungeonGate(
    "swamp-palace",
    "marginSwampPalace",
    "app/Region/Standard/SwampPalace.php:177",
  ),
  thievesTown: dungeonGate(
    "thieves-town",
    "marginThievesTown",
    "app/Region/Standard/ThievesTown.php:118",
  ),
  trinexx: bossGate("Trinexx", "canBeatTrinexx", "marginTrinexx", 119),
  turtleRock: dungeonGate(
    "turtle-rock",
    "marginTurtleRock",
    "app/Region/Standard/TurtleRock.php:261",
  ),
  vitreous: bossGate("Vitreous", "canBeatVitreous", "marginVitreous", 115),
} as const satisfies Readonly<Record<string, MarginGate>>;

export type MarginGateId = keyof typeof MARGIN_GATES;

const GATE_IDS = Object.keys(MARGIN_GATES) as MarginGateId[];

/** The margins' items, which the margin world reads beside STATE_NAMES. */
export const MARGIN_ITEMS: readonly string[] = GATE_IDS.map(
  (id) => MARGIN_GATES[id].item,
);

/** The margin each item drops. */
export const GATE_OF_ITEM: ReadonlyMap<string, MarginGateId> = new Map(
  GATE_IDS.map((id) => [MARGIN_GATES[id].item, id]),
);

/** The state that drops every margin. */
export const MARGIN_STATE: Readonly<Record<string, number>> =
  Object.fromEntries(MARGIN_ITEMS.map((item) => [item, 1]));

const BASIC = "basicPlacement";

/** The dungeon gate a region's health clause is, by the region's id. */
const DUNGEON_GATE: ReadonlyMap<string, MarginGateId> = new Map(
  GATE_IDS.filter((id) => MARGIN_GATES[id].kind === "dungeon").map((id) => [
    id,
    id,
  ]),
);

/** The boss gate of a named rule. */
const BOSS_GATE: ReadonlyMap<string, MarginGateId> = new Map(
  GATE_IDS.flatMap((id) => {
    const gate: MarginGate = MARGIN_GATES[id];
    return gate.kind === "boss" ? [[gate.rule, id] as const] : [];
  }),
);

const itemOf = (id: MarginGateId): Expr => ({
  min: 1,
  name: MARGIN_GATES[id].item,
  type: "item",
});

/** `!setting(name)`. */
const notSetting = (e: Expr, name: string): boolean =>
  e.type === "setting" && e.name === name && e.negated;

/** Whether a requirement reads Link's health (upstream's hasHealth). */
const readsHealth = (e: Expr): boolean => {
  let found = false;
  walk(e, (node) => {
    if (node.type === "helper" && node.name.startsWith("hasHealth")) {
      found = true;
    }
  });
  return found;
};

/** Whether an `or` is the laser bridge's: not basic, or the Cape. */
const isLaserBridge = (e: Expr): boolean =>
  e.type === "or" &&
  e.args.some((arg) => notSetting(arg, BASIC)) &&
  e.args.some((arg) => arg.type === "item" && arg.name === "cape");

/** Whether an `or` is a dungeon's health gate: not basic, or the health. */
export const isHealthGate = (e: Expr): boolean =>
  e.type === "or" &&
  e.args.some((arg) => notSetting(arg, BASIC)) &&
  e.args.some((arg) => !notSetting(arg, BASIC) && readsHealth(arg));

/** A node of the same kind as its parent joins its arguments. */
const flat = (type: "and" | "or", args: readonly Expr[]): Expr => ({
  args: args.flatMap((a) => (a.type === type ? a.args : [a])),
  type,
});

const GANON = itemOf("ganon");
const NOT_SWORDLESS: Expr = {
  name: "swordless",
  negated: true,
  type: "setting",
};

/** `e` rewritten for the margins: the boss gate's for a boss's rule. */
function rewrite(e: Expr, region: string | undefined, boss?: Expr): Expr {
  switch (e.type) {
    case "setting":
      if (boss !== undefined && notSetting(e, BASIC)) {
        return flat("or", [e, boss]);
      }
      if (notSetting(e, "requireBetterSword")) return flat("or", [e, GANON]);
      if (notSetting(e, "requireBetterBow")) {
        return flat("or", [e, flat("and", [NOT_SWORDLESS, GANON])]);
      }
      return e;
    case "maybe":
      return { expr: rewrite(e.expr, region, boss), type: "maybe" };
    case "and":
    case "or": {
      const args = e.args.map((arg) => rewrite(arg, region, boss));
      const node = flat(e.type, args);
      if (boss !== undefined) return node;
      if (isLaserBridge(e)) {
        if (region !== "turtleRock") {
          throw new RangeError(`A laser bridge outside Turtle Rock: ${region}`);
        }
        return flat("or", [...args, itemOf("laserBridge")]);
      }
      if (!isHealthGate(e)) return node;
      const gate = region === undefined ? undefined : DUNGEON_GATE.get(region);
      if (gate === undefined) {
        throw new RangeError(`A health gate outside a dungeon: ${region}`);
      }
      return flat("or", [...args, itemOf(gate)]);
    }
    default:
      return e;
  }
}

/**
 * A requirement of the margin world, by where it sits: a dungeon region's
 * health gate also passed by the dungeon's item, a boss's rule's every
 * basic clause by the boss's, Ganon's better sword and silvers by Ganon's.
 * Any other rule is returned as it is. Throws a RangeError for a health
 * gate in a region that is no gated dungeon.
 */
export function marginRequirement(req: string, site: RuleSite): string {
  const boss = "helper" in site ? BOSS_GATE.get(site.helper) : undefined;
  if (
    !req.includes(`!setting(${BASIC})`) &&
    !req.includes("!setting(requireBetter")
  ) {
    return req;
  }
  const expr = parse(req);
  const relaxed = rewrite(
    expr,
    "region" in site ? site.region : undefined,
    boss === undefined ? undefined : itemOf(boss),
  );
  return JSON.stringify(relaxed) === JSON.stringify(expr)
    ? req
    : print(relaxed);
}

const MARGIN_WORLD = rewrittenWorld(marginRequirement, MARGIN_ITEMS);

/**
 * The region modules of the run's world, basic placement's margins read
 * through `marginRequirement`. Their fill rules are the real world's.
 */
export const marginModules = MARGIN_WORLD.modules;

/** The pack's named rules, the bosses' margins read through it. */
export const MARGIN_RULES = MARGIN_WORLD.rules;

/**
 * The margin world of the run, compiled with its settings: once per settings
 * object. Solve it with the real world's state and `MARGIN_STATE`.
 */
export const compileMargin = MARGIN_WORLD.compile;

/**
 * The margin world's filler, for the key model (`solveWithKeys`): once per
 * settings object. Where the dungeons' items may sit is the real world's.
 */
export const marginFiller = MARGIN_WORLD.filler;
