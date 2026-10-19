// Map Rando's objectives: what a seed asks the player to do before Mother
// Brain's barriers fall (rust/maprando/src/patch.rs, write_objective_data, at
// the commit upstream.json pins). A seed draws them from five groups; each is
// done when its flag in the game's event memory is set, the flag the patch
// writes into the ROM's objective table for the game to check.

/** The groups the pause screen lists objectives under (patch.rs:3327-3346). */
export type ObjectiveGroup =
  | "bosses"
  | "minibosses"
  | "chozos"
  | "pirates"
  | "metroids";

/** One objective a seed may ask for. */
export interface Objective {
  /** The pack's id: "kraid", "metroidRoom1". */
  readonly id: string;
  /** Its name: "Kraid", "Metroid Room 1". */
  readonly name: string;
  readonly group: ObjectiveGroup;
  /**
   * Its flag: the WRAM word at $7E:<address> and the bit the game sets once
   * it is done (patch.rs:3596-3681).
   */
  readonly flag: { readonly address: number; readonly mask: number };
  /** Where its flag was read. */
  readonly source: string;
}

const at = (line: number) => `MapRandomizer rust/maprando/src/patch.rs:${line}`;

const objective = (
  id: string,
  name: string,
  group: ObjectiveGroup,
  address: number,
  mask: number,
  line: number,
): Objective => ({
  flag: { address: 0x7e_0000 | address, mask },
  group,
  id,
  name,
  source: at(line),
});

/**
 * Every objective, in the pause screen's group order (patch.rs:3327-3346).
 * Golden Torizo stands under the minibosses, or under the chozos when it is a
 * seed's only miniboss (patch.rs:3348-3355).
 */
export const OBJECTIVES: readonly Objective[] = [
  objective("kraid", "Kraid", "bosses", 0xd829, 0x01, 3596),
  objective("phantoon", "Phantoon", "bosses", 0xd82b, 0x01, 3598),
  objective("draygon", "Draygon", "bosses", 0xd82c, 0x01, 3599),
  objective("ridley", "Ridley", "bosses", 0xd82a, 0x01, 3597),
  objective("sporeSpawn", "Spore Spawn", "minibosses", 0xd829, 0x02, 3600),
  objective("crocomire", "Crocomire", "minibosses", 0xd82a, 0x02, 3601),
  objective("botwoon", "Botwoon", "minibosses", 0xd82c, 0x02, 3617),
  objective("goldenTorizo", "Golden Torizo", "minibosses", 0xd82a, 0x04, 3618),
  objective("bombTorizo", "Bomb Torizo", "chozos", 0xd828, 0x04, 3635),
  objective("bowlingStatue", "Bowling Statue", "chozos", 0xd823, 0x01, 3636),
  objective(
    "acidChozoStatue",
    "Acid Chozo Statue",
    "chozos",
    0xd821,
    0x10,
    3659,
  ),
  objective("pitRoom", "Pit Room", "pirates", 0xd823, 0x02, 3666),
  objective("babyKraidRoom", "Baby Kraid Room", "pirates", 0xd823, 0x04, 3667),
  objective("plasmaRoom", "Plasma Room", "pirates", 0xd823, 0x08, 3674),
  objective(
    "metalPiratesRoom",
    "Metal Pirates Room",
    "pirates",
    0xd823,
    0x10,
    3681,
  ),
  objective("metroidRoom1", "Metroid Room 1", "metroids", 0xd822, 0x01, 3619),
  objective("metroidRoom2", "Metroid Room 2", "metroids", 0xd822, 0x02, 3626),
  objective("metroidRoom3", "Metroid Room 3", "metroids", 0xd822, 0x04, 3627),
  objective("metroidRoom4", "Metroid Room 4", "metroids", 0xd822, 0x08, 3634),
];

const BY_FLAG = new Map(
  OBJECTIVES.map((o) => [`${o.flag.address}:${o.flag.mask}`, o]),
);

/**
 * The objective whose flag is the event word at $7E:<address> and `mask`, as
 * the ROM's objective table lists it (low word of the address), or undefined
 * for a flag the pack does not know.
 */
export const objectiveByFlag = (
  address: number,
  mask: number,
): Objective | undefined =>
  BY_FLAG.get(`${0x7e_0000 | (address & 0xffff)}:${mask}`);
