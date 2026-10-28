// What the player records, and the state the rules read from it.
//
// The player records items, the dungeons they finished and what each boss
// dropped, what the medallion pads want, and with wild keys the keys they
// found. toState turns that into the engine's state: the items as they
// are, the events and prizes derived from the dungeons (the solver never
// computes them), the pads' facts (medallions.ts) and the derived facts
// (derived.ts). Knowledge is not monotone (learning a pad's medallion can
// lower a location), so toState recomputes everything on every call.
import type { State } from "@alltp/engine";
import { derivedFacts } from "./derived";
import {
  DUNGEONS,
  type DungeonDef,
  type DungeonId,
  dungeonPool,
} from "./dungeons";
import { ITEMS, type ItemId } from "./items";
import { medallionFacts, type PadKnowledge } from "./medallions";
import type { AlttprSettings } from "./settings";
import { type CountKnowledge, unknownCountFacts } from "./unknown-counts";

/**
 * What a dungeon's boss drops, as far as the rules tell them apart: the
 * Pendant of Courage, which Sahasrahla wants; either other pendant, which
 * only the pedestal reads, with all three; crystals 5 and 6, which the
 * Pyramid Fairy wants; any other crystal, which only counts. Each class
 * lists the items it stands for.
 */
export const PRIZES = {
  crystal: ["crystal1", "crystal2", "crystal3", "crystal4", "crystal7"],
  greenPendant: ["pendantOfCourage"],
  pendant: ["pendantOfPower", "pendantOfWisdom"],
  redCrystal: ["crystal5", "crystal6"],
} as const satisfies Readonly<Record<string, readonly ItemId[]>>;

export type Prize = keyof typeof PRIZES;

/**
 * The prizes as an autotracker may count them in a race: the green
 * pendant, the other pendants, and the crystals, never told 5/6 or not.
 */
export type HeldPrize = "crystal" | "greenPendant" | "pendant";

/** The prize classes each held class takes its items from, in order. */
const HELD_FROM: Readonly<Record<HeldPrize, readonly Prize[]>> = {
  // The regular crystals first: a count alone never says a crystal is red
  // until there are more crystals than regular ones
  crystal: ["crystal", "redCrystal"],
  greenPendant: ["greenPendant"],
  pendant: ["pendant"],
};

type PrizeItem = (typeof PRIZES)[Prize][number];
type EventItem = NonNullable<DungeonDef["event"]>["item"];

/**
 * The events the player checks on the map, by location id, and the item
 * each gives: the Bomb Merchant sells the big bomb
 * (Inverted/LightWorld/South.php:29), which Inverted's Pyramid Fairy wants.
 */
export const EVENT_CHECKS = {
  "bomb-merchant": "bigRedBomb",
} as const satisfies Readonly<Record<string, ItemId>>;

type CheckedItem = (typeof EVENT_CHECKS)[keyof typeof EVENT_CHECKS];

/**
 * The items the player marks by hand: every item but the prizes and the
 * events, which the dungeons give, those an event checked on the map gives,
 * and the small keys, which `keys` counts.
 */
export type InventoryItemId = Exclude<
  ItemId,
  PrizeItem | EventItem | CheckedItem | `key${string}`
>;

const DERIVED_ITEMS: ReadonlySet<string> = new Set([
  ...Object.values(PRIZES).flat(),
  ...DUNGEONS.flatMap((d) => ("event" in d ? [d.event.item] : [])),
  ...Object.values(EVENT_CHECKS),
]);

/** The inventory item ids, in the order of ITEMS. */
export const INVENTORY_ITEM_IDS: readonly InventoryItemId[] = ITEMS.map(
  (item) => item.id,
).filter(
  (id): id is InventoryItemId =>
    !DERIVED_ITEMS.has(id) && !id.startsWith("key"),
);

const MAX = new Map<string, number>(ITEMS.map(({ id, max }) => [id, max]));

/** Everything the player records about a run. */
export interface TrackerInput {
  /**
   * The items held, by pack id; one left out is not held. Big keys, maps
   * and compasses count whenever the player marks them.
   */
  readonly items: Readonly<Partial<Record<InventoryItemId, number>>>;
  /**
   * The dungeons finished: the boss beaten, Agahnim for Castle Tower and
   * Agahnim 2 for Ganon's Tower, Zelda led to the Sanctuary for Hyrule
   * Castle.
   */
  readonly beaten: Readonly<Partial<Record<DungeonId, boolean>>>;
  /** What each dungeon's boss drops, as far as the player knows it. */
  readonly prizes: Readonly<Partial<Record<DungeonId, Prize>>>;
  /**
   * The prizes Link holds, whichever dungeons gave them, by class, as an
   * autotracker counts them: at least these many, beside those the
   * dungeons finished give. One left out is none known.
   */
  readonly held?: Readonly<Partial<Record<HeldPrize, number>>>;
  /**
   * What the medallion pads want, as far as the player knows it. A pad left
   * out is unknown, as it is to a player who has not looked.
   */
  readonly medallions: PadKnowledge;
  /**
   * The small keys found in each dungeon, with wild keys (keysanity). The
   * player does not track them otherwise, and they are not read then: the
   * key model (keys.ts) stands in for them. Nor are they with generic keys
   * (the retro world), which no dungeon owns.
   */
  readonly keys?: Readonly<Partial<Record<DungeonId, number>>>;
  /**
   * The locations checked on the map, by id. Only the events of
   * EVENT_CHECKS are read: an item location tells nothing of what it held.
   */
  readonly checked?: Readonly<Record<string, boolean>>;
  /**
   * The counts the player has not recorded (unknown-counts.ts): Link's
   * health, the escape's bombs. A rule asking for one then reads maybe at
   * most, never no; one left out is known, as upstream's tests read it.
   */
  readonly unknown?: CountKnowledge;
}

/** A new run: nothing held, nothing finished, nothing known. */
export const EMPTY_INPUT: TrackerInput = {
  beaten: {},
  items: {},
  medallions: {},
  prizes: {},
};

/** `value` as a count of `id`, within its pool. */
function count(id: string, value: number, max = MAX.get(id) ?? 0): number {
  return Number.isFinite(value)
    ? Math.max(0, Math.min(max, Math.floor(value)))
    : 0;
}

/**
 * The engine state of what the player records, under the run's settings.
 * Items keep their counts, within their pool. Zelda is rescued from the
 * start in an Open world (app/Randomizer.php:133-135), once Hyrule Castle
 * is finished in a Standard one; Agahnim is defeated once Castle Tower is,
 * Agahnim 2 once Ganon's Tower is. A finished dungeon's prize, once known,
 * gives the next item of its class in dungeon order: two red crystals are
 * crystals 5 and 6, whichever dungeons dropped them; a prize the pool has
 * no item left for is a mistake, and gives nothing. The prizes held by
 * class (`held`) top up those the dungeons gave, from the next free items
 * of their class: a crystal counted takes a regular crystal while one is
 * left, so a count makes a crystal red only when there are more crystals
 * than regular ones. The pads' facts read
 * an unknown pad as unknown. The keys count only with wild keys that are
 * not generic. A checked
 * event gives its item (EVENT_CHECKS). A count not known holds its fact
 * (unknown-counts.ts).
 *
 * Pure: a new state on every call, nothing kept between calls. Throws a
 * RangeError for an item id the pack does not have.
 */
export function toState(input: TrackerInput, settings: AlttprSettings): State {
  const state: Record<string, number> = {};
  for (const [id, value] of Object.entries(input.items)) {
    if (!(INVENTORY_ITEM_IDS as readonly string[]).includes(id)) {
      throw new RangeError(`"${id}" is not an item the player marks`);
    }
    const held = count(id, value ?? 0);
    if (held > 0) state[id] = held;
  }
  const finished = (d: DungeonId) => input.beaten[d] === true;
  if (!settings.standardMode || finished("hyrule-castle")) {
    state.rescueZelda = 1;
  }
  for (const [id, item] of Object.entries(EVENT_CHECKS)) {
    if (input.checked?.[id] === true) state[item] = 1;
  }
  const free: Record<Prize, string[]> = {
    crystal: [...PRIZES.crystal],
    greenPendant: [...PRIZES.greenPendant],
    pendant: [...PRIZES.pendant],
    redCrystal: [...PRIZES.redCrystal],
  };
  for (const d of DUNGEONS) {
    if (!finished(d.id)) continue;
    if ("event" in d) {
      state[d.event.item] = 1;
      continue;
    }
    const prize = input.prizes[d.id];
    const item = prize === undefined ? undefined : free[prize].shift();
    if (item !== undefined) state[item] = 1;
  }
  for (const [held, from] of Object.entries(HELD_FROM)) {
    const pool = from.reduce((sum, prize) => sum + PRIZES[prize].length, 0);
    const want = count(held, input.held?.[held as HeldPrize] ?? 0, pool);
    let has = pool - from.reduce((sum, prize) => sum + free[prize].length, 0);
    for (const prize of from) {
      while (has < want && free[prize].length > 0) {
        state[free[prize].shift() as string] = 1;
        has++;
      }
    }
  }
  if (settings.wildKeys && !settings.genericKeys) {
    for (const d of DUNGEONS) {
      const found = count(
        `key${d.code}`,
        input.keys?.[d.id] ?? 0,
        dungeonPool(d).smallKeys,
      );
      if (found > 0) state[`key${d.code}`] = found;
    }
  }
  return {
    ...state,
    ...medallionFacts({
      mire: input.medallions.mire ?? "unknown",
      turtleRock: input.medallions.turtleRock ?? "unknown",
    }),
    ...derivedFacts(state, settings),
    ...unknownCountFacts(input.unknown ?? {}, state),
  };
}
