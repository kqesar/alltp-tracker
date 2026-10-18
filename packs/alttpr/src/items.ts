// The items of ALttPR, and how the randomizer counts them.
//
// Read from sporchia/alttp_vt_randomizer at 219fcafd (LOGIC 31):
// - app/Item.php: every item name and class (`Item::all`) and the aliases;
// - app/Support/ItemCollection.php: how the rules read them (`has`,
//   `hasSword`, `canShootArrows`, `canExtendMagic`, `bottleCount`…);
// - config/item.php: how many of each the item pool holds, which bounds the
//   counts (four progressive swords, six Palace of Darkness keys…).
//
// An id is the lowerCamel upstream name (`fireRod`, `moonPearl`, `keyP3`).
// Where upstream has several items that are levels of one thing, they share
// the id of their progressive version (ProgressiveSword, ProgressiveGlove…
// become `sword`, `glove`…) or of their group in the upstream tests
// (`bottle`, `flute`); `magic` stands for HalfMagic and QuarterMagic.

/** One item a tracker state counts. */
export interface ItemDef {
  /** The state key, and the name requirements use. */
  readonly id: string;
  /** The highest count that means something; 1 for an item held or not. */
  readonly max: number;
}

/**
 * Every item the rules read, with its range. Dungeon items carry the
 * upstream dungeon codes: H2 Hyrule Castle, P1 Eastern Palace, P2 Desert
 * Palace, P3 Tower of Hera, A1 Agahnim's Tower, D1 Palace of Darkness,
 * D2 Swamp Palace, D3 Skull Woods, D4 Thieves' Town, D5 Ice Palace, D6 Misery
 * Mire, D7 Turtle Rock, A2 Ganon's Tower. Only those the pool holds are
 * listed (config/item.php:94-147): Eastern Palace has no small key in v31.
 */
export const ITEMS = [
  // Levels: hasSword(n), hasArmor(n), canLiftRocks / canLiftDarkRocks,
  // canShootArrows(1) / (2), canBlockLasers (shield 3), canExtendMagic
  { id: "sword", max: 4 },
  { id: "shield", max: 3 },
  { id: "armor", max: 2 },
  { id: "glove", max: 2 },
  { id: "bow", max: 2 },
  { id: "silverArrowUpgrade", max: 1 },
  { id: "magic", max: 2 },
  { id: "bottle", max: 4 },
  // 1: the inactive flute; 2: active, so it flies without the weathervane
  // (canFly reads OcarinaInactive only through canActivateOcarina).
  { id: "flute", max: 2 },

  { id: "bombos", max: 1 },
  { id: "bookOfMudora", max: 1 },
  { id: "boomerang", max: 1 },
  { id: "bugCatchingNet", max: 1 },
  { id: "caneOfByrna", max: 1 },
  { id: "caneOfSomaria", max: 1 },
  { id: "cape", max: 1 },
  { id: "ether", max: 1 },
  { id: "fireRod", max: 1 },
  { id: "flippers", max: 1 },
  { id: "hammer", max: 1 },
  { id: "hookshot", max: 1 },
  { id: "iceRod", max: 1 },
  { id: "lamp", max: 1 },
  { id: "magicMirror", max: 1 },
  { id: "moonPearl", max: 1 },
  { id: "mushroom", max: 1 },
  { id: "pegasusBoots", max: 1 },
  { id: "powder", max: 1 },
  { id: "quake", max: 1 },
  { id: "redBoomerang", max: 1 },
  { id: "shovel", max: 1 },
  // canKillEscapeThings reads it
  { id: "tenBombs", max: 1 },

  // hasHealth sums them: a piece is a quarter heart (Item.php:116, 131-156)
  { id: "heartContainer", max: 11 },
  { id: "pieceOfHeart", max: 24 },

  // Prizes and events, which the tracker derives from beaten dungeons
  { id: "pendantOfCourage", max: 1 },
  { id: "pendantOfPower", max: 1 },
  { id: "pendantOfWisdom", max: 1 },
  { id: "crystal1", max: 1 },
  { id: "crystal2", max: 1 },
  { id: "crystal3", max: 1 },
  { id: "crystal4", max: 1 },
  { id: "crystal5", max: 1 },
  { id: "crystal6", max: 1 },
  { id: "crystal7", max: 1 },
  { id: "rescueZelda", max: 1 },
  { id: "defeatAgahnim", max: 1 },
  { id: "defeatAgahnim2", max: 1 },
  // Inverted's Bomb Merchant gives it (Inverted/LightWorld/South.php:27-30),
  // its pyramid fairy wants it (Inverted/DarkWorld/NorthEast.php:67)
  { id: "bigRedBomb", max: 1 },

  // Small keys (config/item.php:108-120)
  { id: "keyH2", max: 1 },
  { id: "keyP2", max: 1 },
  { id: "keyP3", max: 1 },
  { id: "keyA1", max: 2 },
  { id: "keyD1", max: 6 },
  { id: "keyD2", max: 1 },
  { id: "keyD3", max: 3 },
  { id: "keyD4", max: 1 },
  { id: "keyD5", max: 2 },
  { id: "keyD6", max: 3 },
  { id: "keyD7", max: 4 },
  { id: "keyA2", max: 4 },

  // Big keys (config/item.php:95-107)
  { id: "bigKeyP1", max: 1 },
  { id: "bigKeyP2", max: 1 },
  { id: "bigKeyP3", max: 1 },
  { id: "bigKeyD1", max: 1 },
  { id: "bigKeyD2", max: 1 },
  { id: "bigKeyD3", max: 1 },
  { id: "bigKeyD4", max: 1 },
  { id: "bigKeyD5", max: 1 },
  { id: "bigKeyD6", max: 1 },
  { id: "bigKeyD7", max: 1 },
  { id: "bigKeyA2", max: 1 },

  // Maps and compasses: the boss needs them when they are shuffled
  // (`region.wildMaps`, `region.wildCompasses`; config/item.php:121-146)
  { id: "mapH2", max: 1 },
  { id: "mapP1", max: 1 },
  { id: "mapP2", max: 1 },
  { id: "mapP3", max: 1 },
  { id: "mapD1", max: 1 },
  { id: "mapD2", max: 1 },
  { id: "mapD3", max: 1 },
  { id: "mapD4", max: 1 },
  { id: "mapD5", max: 1 },
  { id: "mapD6", max: 1 },
  { id: "mapD7", max: 1 },
  { id: "mapA2", max: 1 },
  { id: "compassP1", max: 1 },
  { id: "compassP2", max: 1 },
  { id: "compassP3", max: 1 },
  { id: "compassD1", max: 1 },
  { id: "compassD2", max: 1 },
  { id: "compassD3", max: 1 },
  { id: "compassD4", max: 1 },
  { id: "compassD5", max: 1 },
  { id: "compassD6", max: 1 },
  { id: "compassD7", max: 1 },
  { id: "compassA2", max: 1 },
] as const satisfies readonly ItemDef[];

export type ItemId = (typeof ITEMS)[number]["id"];

/** Every item id, for `compileWorld`'s check of the names rules use. */
export const ITEM_IDS: readonly ItemId[] = ITEMS.map((item) => item.id);

const MAX = new Map<string, number>(ITEMS.map((item) => [item.id, item.max]));

/**
 * What one upstream item adds to a state. Most add `count` to `item`. An
 * item that is a fixed level of a progressive one (MasterSword, TitansMitt,
 * RedMail…) has `atLeast`: it raises `item` to `count` instead of adding,
 * because upstream tests each level on its own. ProgressiveSword with
 * MasterSword is not hasSword(3) (ItemCollection.php:627-657).
 */
export interface Contribution {
  readonly item: ItemId;
  readonly count: number;
  readonly atLeast?: true;
}

const add = (item: ItemId, count = 1): Contribution => ({ count, item });
const atLeast = (item: ItemId, count: number): Contribution => ({
  atLeast: true,
  count,
  item,
});

/**
 * Every item of app/Item.php, in its order, and what it counts for. `null`
 * means no rule of this pack reads it: rupees, ammunition, bottle contents
 * without a bottle, the generic dungeon items of other modes, and dungeon
 * items the pool does not hold (KeyP1, BigKeyH2…). A few are read only by
 * settings this pack does not model yet; each says which.
 */
export const UPSTREAM_ITEMS: ReadonlyMap<string, Contribution | null> = new Map<
  string,
  Contribution | null
>([
  ["Nothing", null],
  ["L1Sword", atLeast("sword", 1)],
  ["L1SwordAndShield", atLeast("sword", 1)],
  ["L2Sword", atLeast("sword", 2)],
  ["MasterSword", atLeast("sword", 2)],
  ["L3Sword", atLeast("sword", 3)],
  ["L4Sword", atLeast("sword", 4)],
  ["BlueShield", atLeast("shield", 1)],
  ["RedShield", atLeast("shield", 2)],
  ["MirrorShield", atLeast("shield", 3)],
  ["FireRod", add("fireRod")],
  ["IceRod", add("iceRod")],
  ["Hammer", add("hammer")],
  ["Hookshot", add("hookshot")],
  ["Bow", atLeast("bow", 1)],
  ["Boomerang", add("boomerang")],
  ["Powder", add("powder")],
  ["Bee", null],
  ["Bombos", add("bombos")],
  ["Ether", add("ether")],
  ["Quake", add("quake")],
  ["Lamp", add("lamp")],
  ["Shovel", add("shovel")],
  ["OcarinaInactive", atLeast("flute", 1)],
  ["CaneOfSomaria", add("caneOfSomaria")],
  // bottleCount counts every Item\Bottle, whatever it holds
  ["Bottle", add("bottle")],
  ["PieceOfHeart", add("pieceOfHeart")],
  ["CaneOfByrna", add("caneOfByrna")],
  ["Cape", add("cape")],
  ["MagicMirror", add("magicMirror")],
  ["PowerGlove", atLeast("glove", 1)],
  ["TitansMitt", atLeast("glove", 2)],
  ["BookOfMudora", add("bookOfMudora")],
  ["Flippers", add("flippers")],
  ["MoonPearl", add("moonPearl")],
  ["Crystal", null],
  ["BugCatchingNet", add("bugCatchingNet")],
  ["BlueMail", atLeast("armor", 1)],
  ["RedMail", atLeast("armor", 2)],
  ["Key", null],
  ["Compass", null],
  ["HeartContainerNoAnimation", add("heartContainer")],
  ["Bomb", null],
  ["ThreeBombs", null],
  ["Mushroom", add("mushroom")],
  ["RedBoomerang", add("redBoomerang")],
  ["BottleWithRedPotion", add("bottle")],
  ["BottleWithGreenPotion", add("bottle")],
  ["BottleWithBluePotion", add("bottle")],
  ["RedPotion", null],
  ["GreenPotion", null],
  ["BluePotion", null],
  ["TenBombs", add("tenBombs")],
  ["BigKey", null],
  ["Map", null],
  ["OneRupee", null],
  ["FiveRupees", null],
  ["TwentyRupees", null],
  ["PendantOfCourage", add("pendantOfCourage")],
  ["PendantOfWisdom", add("pendantOfWisdom")],
  ["PendantOfPower", add("pendantOfPower")],
  ["BowAndArrows", atLeast("bow", 1)],
  ["BowAndSilverArrows", atLeast("bow", 2)],
  ["BottleWithBee", add("bottle")],
  ["BottleWithFairy", add("bottle")],
  ["BossHeartContainer", add("heartContainer")],
  ["HeartContainer", add("heartContainer")],
  ["OneHundredRupees", null],
  ["FiftyRupees", null],
  ["Heart", null],
  ["Arrow", null],
  ["TenArrows", null],
  ["SmallMagic", null],
  ["ThreeHundredRupees", null],
  ["TwentyRupees2", null],
  ["BottleWithGoldBee", add("bottle")],
  ["OcarinaActive", atLeast("flute", 2)],
  ["PegasusBoots", add("pegasusBoots")],
  ["BombUpgrade5", null],
  ["BombUpgrade10", null],
  ["BombUpgrade50", null],
  ["ArrowUpgrade5", null],
  ["ArrowUpgrade10", null],
  ["ArrowUpgrade70", null],
  // canExtendMagic: a base of 4 with QuarterMagic, else 2 with HalfMagic
  ["HalfMagic", atLeast("magic", 1)],
  ["QuarterMagic", atLeast("magic", 2)],
  ["Programmable1", null],
  ["Programmable2", null],
  ["Programmable3", null],
  // canShootArrows(2): with any bow, it shoots silvers
  ["SilverArrowUpgrade", add("silverArrowUpgrade")],
  ["Rupoor", null],
  ["RedClock", null],
  ["BlueClock", null],
  ["GreenClock", null],
  ["ProgressiveSword", add("sword")],
  ["ProgressiveShield", add("shield")],
  ["ProgressiveArmor", add("armor")],
  ["ProgressiveGlove", add("glove")],
  ["singleRNG", null],
  ["multiRNG", null],
  ["ProgressiveBow", add("bow")],
  // An Item\Bow, but canShootArrows never reads it
  ["ProgressiveBowAlternate", null],
  // The Triforce and its pieces: only the triforce-hunt and ganonhunt goals
  // read them (World.php:103-105, DarkWorld/NorthEast.php:189)
  ["Triforce", null],
  ["PowerStar", null],
  ["TriforcePiece", null],
  ["MapLW", null],
  ["MapDW", null],
  ["MapA2", add("mapA2")],
  ["MapD7", add("mapD7")],
  ["MapD4", add("mapD4")],
  ["MapP3", add("mapP3")],
  ["MapD5", add("mapD5")],
  ["MapD3", add("mapD3")],
  ["MapD6", add("mapD6")],
  ["MapD1", add("mapD1")],
  ["MapD2", add("mapD2")],
  ["MapA1", null],
  ["MapP2", add("mapP2")],
  ["MapP1", add("mapP1")],
  ["MapH1", null],
  ["MapH2", add("mapH2")],
  ["CompassA2", add("compassA2")],
  ["CompassD7", add("compassD7")],
  ["CompassD4", add("compassD4")],
  ["CompassP3", add("compassP3")],
  ["CompassD5", add("compassD5")],
  ["CompassD3", add("compassD3")],
  ["CompassD6", add("compassD6")],
  ["CompassD1", add("compassD1")],
  ["CompassD2", add("compassD2")],
  ["CompassA1", null],
  ["CompassP2", add("compassP2")],
  ["CompassP1", add("compassP1")],
  ["CompassH1", null],
  ["CompassH2", null],
  ["BigKeyA2", add("bigKeyA2")],
  ["BigKeyD7", add("bigKeyD7")],
  ["BigKeyD4", add("bigKeyD4")],
  ["BigKeyP3", add("bigKeyP3")],
  ["BigKeyD5", add("bigKeyD5")],
  ["BigKeyD3", add("bigKeyD3")],
  ["BigKeyD6", add("bigKeyD6")],
  ["BigKeyD1", add("bigKeyD1")],
  ["BigKeyD2", add("bigKeyD2")],
  ["BigKeyA1", null],
  ["BigKeyP2", add("bigKeyP2")],
  ["BigKeyP1", add("bigKeyP1")],
  ["BigKeyH1", null],
  ["BigKeyH2", null],
  ["KeyH2", add("keyH2")],
  ["KeyH1", null],
  ["KeyP1", null],
  ["KeyP2", add("keyP2")],
  ["KeyA1", add("keyA1")],
  ["KeyD2", add("keyD2")],
  ["KeyD1", add("keyD1")],
  ["KeyD6", add("keyD6")],
  ["KeyD3", add("keyD3")],
  ["KeyD5", add("keyD5")],
  ["KeyP3", add("keyP3")],
  ["KeyD4", add("keyD4")],
  ["KeyD7", add("keyD7")],
  ["KeyA2", add("keyA2")],
  // The generic key of retro mode, read through the ShopKey alias below
  ["KeyGK", null],
  ["Crystal1", add("crystal1")],
  ["Crystal2", add("crystal2")],
  ["Crystal3", add("crystal3")],
  ["Crystal4", add("crystal4")],
  ["Crystal5", add("crystal5")],
  ["Crystal6", add("crystal6")],
  ["Crystal7", add("crystal7")],
  ["RescueZelda", add("rescueZelda")],
  ["DefeatAgahnim", add("defeatAgahnim")],
  // Standard's pyramid fairy checks crystals 5 and 6; Inverted's reads it
  ["BigRedBomb", add("bigRedBomb")],
  ["DefeatAgahnim2", add("defeatAgahnim2")],
  ["DefeatGanon", null],
  // Aliases (Item.php:269-271). UncleSword counts as one more progressive
  // sword: hasSword(2) is ProgressiveSword >= 2 or UncleSword with one.
  ["UncleSword", add("sword")],
  // Retro mode: any ShopKey opens every door (ItemCollection::has), and
  // the rupee bow needs ShopArrow (canShootArrows)
  ["ShopKey", null],
  ["ShopArrow", null],
]);

/**
 * English names the upstream tests use for an item: `Item::get` falls back
 * to the item whose English name matches (Item.php:29-61), so 'Flute' is
 * OcarinaInactive (resources/lang/en/item.php:29).
 */
export const UPSTREAM_ENGLISH_NAMES: ReadonlyMap<string, string> = new Map([
  ["Flute", "OcarinaInactive"],
]);

/**
 * What an upstream item name counts for, or null when no rule reads it.
 * Accepts the English names in UPSTREAM_ENGLISH_NAMES; throws on a name
 * upstream does not have, which would otherwise count as nothing.
 */
export function fromUpstream(name: string): Contribution | null {
  const contribution = UPSTREAM_ITEMS.get(
    UPSTREAM_ENGLISH_NAMES.get(name) ?? name,
  );
  if (contribution === undefined) {
    throw new RangeError(`Unknown upstream item "${name}"`);
  }
  return contribution;
}

/**
 * The state for a collection of upstream items, as upstream counts them:
 * per item, the sum of what adds to it or the highest level reached,
 * whichever is greater, within the item's range. Only held items appear.
 * The order of `names` does not matter, and adding a name never lowers a
 * count.
 */
export function stateFromUpstream(
  names: Iterable<string>,
): Partial<Record<ItemId, number>> {
  const added = new Map<ItemId, number>();
  const levels = new Map<ItemId, number>();
  for (const name of names) {
    const contribution = fromUpstream(name);
    if (contribution === null) continue;
    const { count, item } = contribution;
    if (contribution.atLeast) {
      levels.set(item, Math.max(levels.get(item) ?? 0, count));
    } else {
      added.set(item, (added.get(item) ?? 0) + count);
    }
  }
  const state: Partial<Record<ItemId, number>> = {};
  for (const item of ITEM_IDS) {
    const count = Math.min(
      MAX.get(item) ?? 0,
      Math.max(added.get(item) ?? 0, levels.get(item) ?? 0),
    );
    if (count > 0) state[item] = count;
  }
  return state;
}
