// The tricks world: the run's world with six minor tricks as items a player
// may hold, so that the tracker can tell which checks a trick would open.
//
// Read from sporchia/alttp_vt_randomizer at 219fcafd (LOGIC 31). The region
// rules gate a trick's branch on a config flag (`config('canFakeFlipper',
// false)`, World.php:445-461), which NoGlitches never sets
// (config/logic.php:4): OverworldGlitches turns on fake flipper, water walk,
// super bunny and dungeon revival among others (logic.php:5-13), and bunny
// revival is set by no logic, only by the customizer (resources/js/store/
// modules/glitches.js:8). Dark rooms are `has('Lamp',
// config('item.require.Lamp', 1))`, which the customizer's "Allow dark room
// navigation" sets to 0 (CustomizerController.php:156;
// resources/js/components/Customizer/Settings.vue:74-84), and `has($key, 0)`
// is true with no Lamp at all (ItemCollection.php:260).
//
// A setting is folded at compile time, so the real world cannot hold a trick
// for some states and not others. This world rewrites each rule instead:
// `setting(canFakeFlipper)` becomes the item `trickFakeFlipper`, and a test
// whose threshold is `setting(requireLamp)` becomes `(lamp >=
// setting(requireLamp) | trickDarkRooms)`. With a trick's item at 1 it reads
// as the real world compiled with that flag on (or requireLamp at 0), with
// all of them at 0 as the real world; tricks.spec.ts holds both. The fill
// rules are left as they are: the seed was placed under NoGlitches, so where
// an item may sit does not move.
import {
  type CompiledWorld,
  compileWorld,
  type Expr,
  loadRules,
  parse,
  print,
  type RulesSource,
} from "@alltp/engine";
import { type Filler, filler } from "./fill";
import type { LocationDef } from "./location";
import { regionModules, STATE_NAMES } from "./pack";
import { RULES } from "./rules";
import type { AlttprSettings } from "./settings";
import { buildWorld, type RegionDef, type RegionModule } from "./world";

/** The tricks, in the order a player learns them. */
export const TRICK_IDS = [
  "darkRooms",
  "fakeFlipper",
  "waterWalk",
  "superBunny",
  "bunnyRevive",
  "dungeonRevive",
] as const;

export type TrickId = (typeof TRICK_IDS)[number];

/** A trick: the item that stands for it, what it relaxes and where. */
export interface TrickDef {
  readonly id: TrickId;
  /** Its item in the tricks world's state, 0 or 1. */
  readonly item: string;
  /**
   * The setting it stands for: a glitch flag the rules read as
   * `setting(...)`, or `requireLamp`, the threshold of the dark rooms.
   */
  readonly setting: keyof AlttprSettings;
  /** Where upstream turns it on: a logic, or the customizer alone. */
  readonly source: string;
}

export const TRICKS: Readonly<Record<TrickId, TrickDef>> = {
  bunnyRevive: {
    id: "bunnyRevive",
    item: "trickBunnyRevive",
    setting: "canBunnyRevive",
    source: "resources/js/store/modules/glitches.js:8",
  },
  darkRooms: {
    id: "darkRooms",
    item: "trickDarkRooms",
    setting: "requireLamp",
    source: "app/Http/Controllers/CustomizerController.php:156",
  },
  dungeonRevive: {
    id: "dungeonRevive",
    item: "trickDungeonRevive",
    setting: "canDungeonRevive",
    source: "config/logic.php:12",
  },
  fakeFlipper: {
    id: "fakeFlipper",
    item: "trickFakeFlipper",
    setting: "canFakeFlipper",
    source: "config/logic.php:7",
  },
  superBunny: {
    id: "superBunny",
    item: "trickSuperBunny",
    setting: "canSuperBunny",
    source: "config/logic.php:6",
  },
  waterWalk: {
    id: "waterWalk",
    item: "trickWaterWalk",
    setting: "canWaterWalk",
    source: "config/logic.php:11",
  },
};

/** The tricks' items, which the tricks world reads beside STATE_NAMES. */
export const TRICK_ITEMS: readonly string[] = TRICK_IDS.map(
  (id) => TRICKS[id].item,
);

/** The state that holds these tricks: each one's item at 1. */
export function trickState(
  tricks: Iterable<TrickId>,
): Readonly<Record<string, number>> {
  const state: Record<string, number> = {};
  for (const id of tricks) state[TRICKS[id].item] = 1;
  return state;
}

const LAMP = "requireLamp";
const ITEM_OF_FLAG: ReadonlyMap<string, string> = new Map(
  TRICK_IDS.filter((id) => TRICKS[id].setting !== LAMP).map((id) => [
    TRICKS[id].setting,
    TRICKS[id].item,
  ]),
);
const DARK_ROOMS: Expr = { min: 1, name: TRICKS.darkRooms.item, type: "item" };

/** A node of the same kind as its parent joins its arguments. */
const flat = (type: "and" | "or", args: readonly Expr[]): Expr => ({
  args: args.flatMap((a) => (a.type === type ? a.args : [a])),
  type,
});

function rewrite(e: Expr, req: string): Expr {
  switch (e.type) {
    case "setting": {
      const item = ITEM_OF_FLAG.get(e.name);
      if (item === undefined) return e;
      // A trick held may only open more: a rule asking for its absence
      // would close a check when the player learns the trick
      if (e.negated) {
        throw new RangeError(`"${req}" asks a trick to be off: ${e.name}`);
      }
      return { min: 1, name: item, type: "item" };
    }
    case "item":
    case "count":
      return typeof e.min === "object" && e.min.setting === LAMP
        ? flat("or", [e, DARK_ROOMS])
        : e;
    case "maybe":
      return { expr: rewrite(e.expr, req), type: "maybe" };
    case "and":
    case "or":
      return flat(
        e.type,
        e.args.map((a) => rewrite(a, req)),
      );
    default:
      return e;
  }
}

/**
 * A requirement of the tricks world: every trick flag of `req` read as its
 * item, every dark room as the Lamp or the trick. Throws a RangeError for a
 * rule that asks a trick to be off, which no monotone world can hold.
 */
export function trickRequirement(req: string): string {
  if (!req.includes("setting(can") && !req.includes(LAMP)) return req;
  return print(rewrite(parse(req), req));
}

function trickLocation(location: LocationDef): LocationDef {
  const req = trickRequirement(location.req);
  const visible = location.visible;
  const seen =
    visible?.req === undefined ? undefined : trickRequirement(visible.req);
  if (req === location.req && seen === visible?.req) return location;
  return {
    ...location,
    req,
    ...(visible === undefined ? {} : { visible: { ...visible, req: seen } }),
  };
}

function trickRegion(region: RegionDef): RegionDef {
  return {
    ...region,
    entrances: region.entrances.map((entrance) => ({
      ...entrance,
      req: trickRequirement(entrance.req),
    })),
    locations: region.locations.map(trickLocation),
  };
}

const rewritten = new WeakMap<
  readonly RegionModule[],
  readonly RegionModule[]
>();

/**
 * The region modules of the run's world, every rule read for the tricks:
 * the entrances', the locations' and what seeing a location needs. Their
 * fill rules are the real world's.
 */
export function trickModules(
  settings: AlttprSettings,
): readonly RegionModule[] {
  const modules = regionModules(settings);
  let found = rewritten.get(modules);
  if (found === undefined) {
    found = modules.map((module) => ({
      ...module,
      regions: module.regions.map(trickRegion),
    }));
    rewritten.set(modules, found);
  }
  return found;
}

/** The pack's named rules, read for the tricks. */
export const TRICK_RULES: RulesSource = {
  ...RULES,
  helpers: Object.fromEntries(
    Object.entries(RULES.helpers ?? {}).map(([name, req]) => [
      name,
      trickRequirement(req),
    ]),
  ),
};

const compiled = new WeakMap<AlttprSettings, CompiledWorld>();
const fillers = new WeakMap<AlttprSettings, Filler>();

/**
 * The tricks world of the run, compiled with its settings: once per
 * settings object. Solve it with the state of the real world and the items
 * of the tricks the player knows (`trickState`).
 */
export function compileTricks(settings: AlttprSettings): CompiledWorld {
  let found = compiled.get(settings);
  if (found === undefined) {
    found = compileWorld(
      buildWorld(trickModules(settings)),
      loadRules(TRICK_RULES),
      { items: [...STATE_NAMES, ...TRICK_ITEMS], settings },
    );
    compiled.set(settings, found);
  }
  return found;
}

/**
 * The tricks world's filler, for the key model (`solveWithKeys`): once per
 * settings object. Where the dungeons' items may sit is the real world's.
 */
export function trickFiller(settings: AlttprSettings): Filler {
  let found = fillers.get(settings);
  if (found === undefined) {
    found = filler(compileTricks(settings), settings, trickModules(settings));
    fillers.set(settings, found);
  }
  return found;
}
