// Location::canFill: whether the randomizer may place an item at a location.
//
// Read from sporchia/alttp_vt_randomizer at 219fcafd (LOGIC 31),
// app/Location.php:72-85. The location takes the item when its always-allow
// says so, or when its region keeps the item (Region::canFill, world.ts),
// its fill rules accept it and Link can reach it with the item placed there:
//
//   always(item, items) || (region.canFill(item) && fill(item, items)
//                           && canAccess(items))
//
// canFill sets the item first (76), so a rule that asks what the location
// holds sees it: `fill.holding` (location.ts) is that rule. And setItem
// itself throws for a prize or medallion location given anything but a
// pendant or crystal, an event or a medallion (Location/Prize.php:24-32,
// Prize/Event.php:21-29, Medallion.php:23-31), so those take nothing else.
//
// The fill rules live with their locations, in the region modules, as the
// region files set them. This module reads them for a world and a state.
import {
  and,
  type CompiledWorld,
  type Expr,
  evaluate,
  loadRules,
  or,
  parse,
  type Solution,
  type State,
  solve,
  type Tri,
} from "@alltp/engine";
import type { ItemMatch, LocationDef } from "./location";
import { regionModules } from "./pack";
import { RULES } from "./rules";
import type { AlttprSettings } from "./settings";
import {
  dungeonItemClass,
  type RegionDef,
  type RegionModule,
  canFill as regionCanFill,
} from "./world";

/**
 * The upstream items of the classes a prize or a medallion location takes
 * (app/Item.php: Item\Pendant 148-150, Item\Crystal 125 and 254-260,
 * Item\Event 192 and 261-265, Item\Medallion 108-110).
 */
export const PRIZE_ITEMS = {
  crystal: [
    "Crystal",
    "Crystal1",
    "Crystal2",
    "Crystal3",
    "Crystal4",
    "Crystal5",
    "Crystal6",
    "Crystal7",
  ],
  event: [
    "Triforce",
    "RescueZelda",
    "DefeatAgahnim",
    "BigRedBomb",
    "DefeatAgahnim2",
    "DefeatGanon",
  ],
  medallion: ["Bombos", "Ether", "Quake"],
  pendant: ["PendantOfCourage", "PendantOfWisdom", "PendantOfPower"],
} as const satisfies Readonly<Record<string, readonly string[]>>;

/**
 * The prize locations that are Location\Prize\Event, which take events
 * only: Zelda (Standard/HyruleCastleEscape.php:51), Agahnim
 * (HyruleCastleTower.php:43), Agahnim 2 (GanonsTower.php:80), Ganon
 * (DarkWorld/NorthEast.php:36; Inverted/LightWorld/NorthEast.php:19) and,
 * in an Inverted world, the Bomb Merchant (Inverted/LightWorld/South.php:27).
 * The dungeons' prizes take a pendant or a crystal.
 */
export const EVENT_LOCATIONS: readonly string[] = [
  "agahnim",
  "agahnim-2",
  "bomb-merchant",
  "ganon",
  "zelda",
];

/** Whether setItem lets a location hold the item at all. */
function holdable(location: LocationDef, item: string): boolean {
  const among = (...classes: (keyof typeof PRIZE_ITEMS)[]) =>
    classes.some((c) => (PRIZE_ITEMS[c] as readonly string[]).includes(item));
  if (location.kind === "medallion") return among("medallion");
  if (location.kind !== "prize") return true;
  return EVENT_LOCATIONS.includes(location.id)
    ? among("event")
    : among("crystal", "pendant");
}

/** Whether an ItemMatch names the item. */
export function matches(match: ItemMatch, item: string): boolean {
  if ("items" in match) return match.items.includes(item);
  if ("allBut" in match) return !match.allBut.includes(item);
  const kind = dungeonItemClass(item);
  return kind !== undefined && match.classes.includes(kind);
}

const rules = loadRules(RULES);
const parsed = new Map<string, Expr>();
const expr = (req: string): Expr => {
  let found = parsed.get(req);
  if (found === undefined) {
    found = parse(req);
    parsed.set(req, found);
  }
  return found;
};

/** Location::canFill over one world: build once per run, ask per item. */
export interface Filler {
  /** The compiled world it fills. */
  readonly world: CompiledWorld;
  /** The settings that world was compiled with. */
  readonly settings: AlttprSettings;
  /**
   * The region modules that world was built from: the run's
   * (`regionModules`), or the tricks world's (`trickModules`), whose rules
   * read the tricks' items.
   */
  readonly modules: readonly RegionModule[];
  /** The world's location ids, in the order of its regions. */
  readonly locations: readonly string[];
  /**
   * Whether the randomizer may place `item` (an upstream name, `KeyD1`) at
   * the location for the items `state` holds: `yes` as upstream's true,
   * `maybe` where the answer hangs on where other items sit, which a
   * tracker does not know. Pass the state's solution if it is at hand.
   * Throws a RangeError for a location the world does not have.
   */
  canFill(
    location: string,
    item: string,
    state: State,
    solution?: Solution,
  ): Tri;
}

/**
 * The filler of a compiled world, under the settings it was compiled with
 * and the modules it was built from (the run's world by default).
 */
export function filler(
  compiled: CompiledWorld,
  settings: AlttprSettings,
  modules: readonly RegionModule[] = regionModules(settings),
): Filler {
  const where = new Map<string, { location: LocationDef; region: RegionDef }>();
  for (const module of modules) {
    for (const region of module.regions) {
      for (const location of region.locations) {
        where.set(location.id, { location, region });
      }
    }
  }
  const holds = (req: string) =>
    evaluate(expr(req), {}, rules, { settings }) === "yes";
  return {
    canFill(id, item, state, solution = solve(compiled, state)) {
      const found = where.get(id);
      if (found === undefined) {
        throw new RangeError(`No location "${id}" in this world`);
      }
      const { location, region } = found;
      if (!holdable(location, item)) return "no";
      // No Logic sets no rule, the fill rules and access included (World.php:
      // 93, Location.php:77-81): only the region's own canFill holds
      if (settings.noLogic) {
        return regionCanFill(region, item, settings) ? "yes" : "no";
      }
      const fill = location.fill;
      const options = { regions: solution.regions(), settings };
      const value = (req: string) => evaluate(expr(req), state, rules, options);
      const allowed = fill?.always;
      const always = allowed?.items.includes(item) ? value(allowed.req) : "no";
      if (always === "yes" || !regionCanFill(region, item, settings)) {
        return always;
      }
      const refused = (fill?.refuse ?? []).some(
        (r) =>
          matches(r.refuse, item) && (r.when === undefined || holds(r.when)),
      );
      if (refused) return always;
      const holding = fill?.holding;
      const access =
        holding === undefined
          ? solution.location(id)
          : and(
              solution.region(region.id),
              value(
                (Object.hasOwn(holding.items, item)
                  ? holding.items[item]
                  : holding.otherwise) ?? location.req,
              ),
            );
      const requires = fill?.requires ? value(fill.requires.req) : "yes";
      return or(always, and(requires, access));
    },
    locations: [...where.keys()],
    modules,
    settings,
    world: compiled,
  };
}
