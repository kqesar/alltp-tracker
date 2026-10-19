// The items SMZ3's logic reads, as the engine's state names them, and how
// upstream's item types become them.
//
// Read from tewtal/SMZ3Randomizer at d53be76, Randomizer.SMZ3/Item.cs: the
// Progression class (what the logic sees of the items held) and the pools
// (CreateProgressionPool, CreateNicePool, CreateJunkPool, CreateDungeonPool,
// CreateKeycards), which give each item's most. A progressive item is one
// count (`sword >= 2` is the Master Sword); the tank and ammunition counts
// are the packs found, which the logic reads as held or not, but for the
// two power bomb packs (TwoPowerBombs) and the tanks (HasEnergyReserves).
//
// The rewards (pendants, crystals, Super Metroid's boss tokens) are no
// item upstream: the logic asks whether the boss holding one can be beaten
// (World.CanAcquire). A tracker counts the ones found instead (helpers.ts).

/** An item of the state: its id and the most a run holds. */
export interface Smz3Item {
  readonly id: string;
  readonly max: number;
}

const one = (...ids: string[]) => ids.map((id) => ({ id, max: 1 }));

/** A Link to the Past's half: its items, then its dungeons' keys. */
const ZELDA: readonly Smz3Item[] = [
  { id: "sword", max: 4 },
  { id: "shield", max: 3 },
  { id: "glove", max: 2 },
  { id: "bottle", max: 4 },
  ...one(
    "bow",
    "hookshot",
    "mushroom",
    "powder",
    "firerod",
    "icerod",
    "bombos",
    "ether",
    "quake",
    "lamp",
    "hammer",
    "shovel",
    "flute",
    "book",
    "somaria",
    "byrna",
    "cape",
    "mirror",
    "boots",
    "flippers",
    "moonPearl",
    "halfMagic",
  ),
  // CreateDungeonPool: each dungeon's small keys and big key
  ...one("keyHC", "keyDP", "keyTH", "keySP", "keyTT"),
  { id: "keyCT", max: 2 },
  { id: "keyPD", max: 6 },
  { id: "keySW", max: 3 },
  { id: "keyIP", max: 2 },
  { id: "keyMM", max: 3 },
  { id: "keyTR", max: 4 },
  { id: "keyGT", max: 4 },
  ...one(
    "bigKeyEP",
    "bigKeyDP",
    "bigKeyTH",
    "bigKeyPD",
    "bigKeySP",
    "bigKeySW",
    "bigKeyTT",
    "bigKeyIP",
    "bigKeyMM",
    "bigKeyTR",
    "bigKeyGT",
  ),
];

/**
 * Super Metroid's keycards: placed only with keysanity (CreateKeycards);
 * without it the logic holds every one (the filler starts from them, and
 * LogicTests.AllKeycards gives them to every case).
 */
export const KEYCARDS = [
  "cardCrateriaL1",
  "cardCrateriaL2",
  "cardCrateriaBoss",
  "cardBrinstarL1",
  "cardBrinstarL2",
  "cardBrinstarBoss",
  "cardNorfairL1",
  "cardNorfairL2",
  "cardNorfairBoss",
  "cardMaridiaL1",
  "cardMaridiaL2",
  "cardMaridiaBoss",
  "cardWreckedShipL1",
  "cardWreckedShipBoss",
  "cardLowerNorfairL1",
  "cardLowerNorfairBoss",
] as const;

/** Super Metroid's half: its items, then its keycards. */
const SUPER_METROID: readonly Smz3Item[] = [
  ...one(
    "grapple",
    "charge",
    "ice",
    "wave",
    "plasma",
    "varia",
    "gravity",
    "morph",
    "bombs",
    "springBall",
    "screwAttack",
    "hiJump",
    "spaceJump",
    "speedBooster",
  ),
  { id: "missile", max: 40 },
  { id: "super", max: 16 },
  { id: "powerBomb", max: 10 },
  { id: "eTank", max: 14 },
  { id: "reserveTank", max: 4 },
  ...one(...KEYCARDS),
];

/** The rewards a run's bosses hold (Region.cs, RewardType), as found. */
const REWARDS: readonly Smz3Item[] = [
  { id: "pendantGreen", max: 1 },
  { id: "pendantNonGreen", max: 2 },
  { id: "crystalBlue", max: 5 },
  { id: "crystalRed", max: 2 },
  ...one("tokenKraid", "tokenPhantoon", "tokenDraygon", "tokenRidley"),
];

export const ITEMS: readonly Smz3Item[] = [
  ...ZELDA,
  ...SUPER_METROID,
  ...REWARDS,
];

export const ITEM_IDS: readonly string[] = ITEMS.map(({ id }) => id);

const MAX = new Map(ITEMS.map(({ id, max }) => [id, max]));

/**
 * Upstream's item types that the state counts under another name; every
 * other type the logic reads is its own name in lower camel case
 * (`MoonPearl` is moonPearl, `ETank` eTank).
 */
const RENAMED: Readonly<Record<string, string>> = {
  ProgressiveGlove: "glove",
  ProgressiveShield: "shield",
  ProgressiveSword: "sword",
};

/** The state's item for an upstream item type, or undefined for one the logic ignores. */
export function fromUpstream(type: string): string | undefined {
  const id = RENAMED[type] ?? `${type.charAt(0).toLowerCase()}${type.slice(1)}`;
  return MAX.has(id) ? id : undefined;
}

/**
 * The state of an upstream inventory, item type to count (as the logic
 * tests build it): each counted at most its pool's most. Throws on a type
 * no item of the state stands for, which a fixture never holds.
 */
export function stateFromUpstream(
  inventory: Readonly<Record<string, number>>,
): Record<string, number> {
  const state: Record<string, number> = {};
  for (const [type, count] of Object.entries(inventory)) {
    const id = fromUpstream(type);
    if (id === undefined) throw new RangeError(`No item for ${type}`);
    state[id] = Math.min((state[id] ?? 0) + count, MAX.get(id) ?? 0);
  }
  return state;
}
