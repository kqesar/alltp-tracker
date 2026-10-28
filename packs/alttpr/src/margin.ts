// Basic placement's safety margin, as an item a state may hold: the world in
// which the tracker asks what a run could do but for that margin.
//
// Read from sporchia/alttp_vt_randomizer at 219fcafd (LOGIC 31), as the
// regions port it. With basic item placement, the dark world's dungeons and
// Ganon's Tower are in logic only once Link can take a beating: a sword (or
// a swordless run), 7 hearts found and a bottle before Palace of Darkness,
// Swamp Palace, Skull Woods and Thieves' Town (SwampPalace.php:177,
// SkullWoods.php:153, ThievesTown.php:118), the Master Sword, 12 hearts
// found and two bottles or a mail before Ice Palace, Misery Mire, Turtle
// Rock and Ganon's Tower (MiseryMire.php:132), each the clause
// `itemPlacement !== 'basic' || …hasHealth(n)…`, in Standard's regions and
// Inverted's alike. It is a placement guarantee: the generator never needs
// those places before Link has that margin, yet a player can do them
// without it. Here each such clause, `!setting(basicPlacement) | gate`
// where the gate reads Link's health, becomes `!setting(basicPlacement) |
// gate | basicMargin`: with `basicMargin` at 0 the world reads as the real
// one, at 1 as the real one without those gates.
//
// Only the health gates move. Every other rule basic placement changes stays
// as it is: the bosses' weapons (bosses.ts), Turtle Rock's laser bridge, the
// Pegasus Boots for a hookshot gap, Ganon's Tower's torches, the Book of
// Mudora at the Pedestal, Ganon's silver arrows and better sword
// (requireBetterBow, requireBetterSword): those say what the seed expects a
// player to know or to fight with, not how much damage Link can take.
import { type Expr, parse, print, walk } from "@alltp/engine";
import { rewrittenWorld } from "./rewritten";

/** The item that drops basic placement's safety margin, 0 or 1. */
export const MARGIN_ITEM = "basicMargin";

const BASIC = "basicPlacement";

/** The state that drops the margin. */
export const MARGIN_STATE: Readonly<Record<string, number>> = {
  [MARGIN_ITEM]: 1,
};

const MARGIN: Expr = { min: 1, name: MARGIN_ITEM, type: "item" };

/** `!setting(basicPlacement)`: anything but basic placement. */
const notBasic = (e: Expr): boolean =>
  e.type === "setting" && e.name === BASIC && e.negated;

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

/** Whether an `or` is basic placement's gate: not basic, or the health. */
export const isMarginGate = (e: Expr): boolean =>
  e.type === "or" &&
  e.args.some(notBasic) &&
  e.args.some((arg) => !notBasic(arg) && readsHealth(arg));

function rewrite(e: Expr): Expr {
  switch (e.type) {
    case "maybe":
      return { expr: rewrite(e.expr), type: "maybe" };
    case "and":
    case "or": {
      const args = e.args.map(rewrite);
      const node: Expr = { args, type: e.type };
      return isMarginGate(node)
        ? { args: [...args, MARGIN], type: "or" }
        : node;
    }
    default:
      return e;
  }
}

/**
 * A requirement of the margin world: each of basic placement's health gates
 * also passed by `basicMargin`. Any other rule is returned as it is.
 */
export function marginRequirement(req: string): string {
  if (!req.includes(`!setting(${BASIC})`) || !req.includes("@hasHealth")) {
    return req;
  }
  const expr = parse(req);
  const relaxed = rewrite(expr);
  return JSON.stringify(relaxed) === JSON.stringify(expr)
    ? req
    : print(relaxed);
}

const MARGIN_WORLD = rewrittenWorld(marginRequirement, [MARGIN_ITEM]);

/**
 * The region modules of the run's world, basic placement's health gates
 * read through `marginRequirement`. Their fill rules are the real world's.
 */
export const marginModules = MARGIN_WORLD.modules;

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
