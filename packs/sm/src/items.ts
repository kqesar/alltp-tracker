// Super Metroid's items as Map Rando has them (rust/maprando-game/src/lib.rs,
// `enum Item`, at the commit upstream.json pins): what a player collects and
// a tracker shows. An item is held or not, or counted: the ammunition packs
// and the tanks, of which a seed holds a pool.
//
// Map Rando adds three items to the game's: the Wall Jump Boots (an option:
// wall jumps need them) and the Spark and Blue Boosters (an option that splits
// the Speed Booster in two). Nothing (its "Nothing" item) is no item.

/** One of the items a player collects. */
export interface SmItem {
  /** The pack's id: "morph", "superMissile". */
  readonly id: string;
  /** Its name in the game: "Morphing Ball". */
  readonly name: string;
  /**
   * Its index in Map Rando's `enum Item` (lib.rs:155-181), which the
   * randomizer's own data and its item sprites follow.
   */
  readonly index: number;
  /**
   * Its variant in that enum ("ETank", "Super", "XRayScope"), the name the
   * randomizer's spoiler log writes (`Item::VARIANTS`, spoiler_log.rs:1236).
   */
  readonly variant: string;
  /**
   * The most a seed holds: 1 for an item held or not; for a counted item,
   * its packs or tanks in the game's full pool (Map Rando's "Full" item pool
   * is the game's own: 46 missiles, 10 super missiles, 10 power bombs, 14
   * energy and 4 reserve tanks).
   */
  readonly max: number;
}

const item = (
  id: string,
  name: string,
  index: number,
  variant: string,
  max = 1,
): SmItem => ({
  id,
  index,
  max,
  name,
  variant,
});

/** Every item, in Map Rando's order (lib.rs:155-181) but Nothing. */
export const SM_ITEMS: readonly SmItem[] = [
  item("energyTank", "Energy Tank", 0, "ETank", 14),
  item("missile", "Missile", 1, "Missile", 46),
  item("superMissile", "Super Missile", 2, "Super", 10),
  item("powerBomb", "Power Bomb", 3, "PowerBomb", 10),
  item("bombs", "Bombs", 4, "Bombs"),
  item("charge", "Charge Beam", 5, "Charge"),
  item("ice", "Ice Beam", 6, "Ice"),
  item("hiJump", "Hi-Jump Boots", 7, "HiJump"),
  item("speedBooster", "Speed Booster", 8, "SpeedBooster"),
  item("wave", "Wave Beam", 9, "Wave"),
  item("spazer", "Spazer", 10, "Spazer"),
  item("springBall", "Spring Ball", 11, "SpringBall"),
  item("varia", "Varia Suit", 12, "Varia"),
  item("gravity", "Gravity Suit", 13, "Gravity"),
  item("xRay", "X-Ray Scope", 14, "XRayScope"),
  item("plasma", "Plasma Beam", 15, "Plasma"),
  item("grapple", "Grapple Beam", 16, "Grapple"),
  item("spaceJump", "Space Jump", 17, "SpaceJump"),
  item("screwAttack", "Screw Attack", 18, "ScrewAttack"),
  item("morph", "Morphing Ball", 19, "Morph"),
  item("reserveTank", "Reserve Tank", 20, "ReserveTank", 4),
  item("wallJump", "Wall Jump Boots", 21, "WallJump"),
  item("sparkBooster", "Spark Booster", 23, "SparkBooster"),
  item("blueBooster", "Blue Booster", 24, "BlueBooster"),
];

export type SmItemId = (typeof SM_ITEMS)[number]["id"];

const BY_ID = new Map(SM_ITEMS.map((i) => [i.id, i]));

/** An item by id; throws on one the pack does not know. */
export const smItem = (id: string): SmItem => {
  const found = BY_ID.get(id);
  if (found === undefined)
    throw new RangeError(`No Super Metroid item "${id}"`);
  return found;
};
