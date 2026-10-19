// Where memory says a location was checked.
//
// Zelda's: a flag in its save data, which the ALttPR pack's CHECK_FLAGS
// gives for the same location (by ZELDA_ALIASES), kept as data
// (zelda-flags.json): flags.spec.ts derives the file from the ALttPR pack and
// holds it to that, `vitest -u` writing it again when those flags move.
// The fork of z3randomizer the combo ROM embeds lays its save as the ALttPR
// pack reads it (src/z3/randomizer/sram.asm).
//
// Super Metroid's: a location is checked once its item's bit is set in the
// items collected, $7E:D870 (save offset $B0). Upstream's location id is that
// bit (the item PLM's argument in the vanilla ROM, checked for 99 of the 100
// locations; the patch moves the Morphing Ball's PLM, whose bit is still
// $1A); flags.spec.ts holds this table to upstream's ids.
import ZELDA from "./zelda-flags.json";

/** A Zelda location's flag: a byte or word of its save data, by offset. */
export interface ZeldaFlag {
  readonly id: string;
  /** From the save data's start, $7E:F000. */
  readonly offset: number;
  readonly size: 1 | 2;
  /** Checked when any of these bits is set (little endian). */
  readonly mask: number;
}

/** Every Zelda location's flag, in the pack's order. */
export const ZELDA_FLAGS = ZELDA as readonly ZeldaFlag[];

/** Each Super Metroid location's bit in the items collected. */
export const SM_ITEM_BITS: ReadonlyMap<string, number> = new Map([
  ["power-bomb-crateria-surface", 0],
  ["missile-outside-wrecked-ship-bottom", 1],
  ["missile-outside-wrecked-ship-top", 2],
  ["missile-outside-wrecked-ship-middle", 3],
  ["missile-crateria-moat", 4],
  ["energy-tank-gauntlet", 5],
  ["missile-crateria-bottom", 6],
  ["bombs", 7],
  ["energy-tank-terminator", 8],
  ["missile-crateria-gauntlet-right", 9],
  ["missile-crateria-gauntlet-left", 10],
  ["super-missile-crateria", 11],
  ["missile-crateria-middle", 12],
  ["power-bomb-green-brinstar-bottom", 13],
  ["super-missile-pink-brinstar", 14],
  ["missile-green-brinstar-below-super-missile", 15],
  ["super-missile-green-brinstar-top", 16],
  ["reserve-tank-brinstar", 17],
  ["missile-green-brinstar-behind-missile", 18],
  ["missile-green-brinstar-behind-reserve-tank", 19],
  ["missile-pink-brinstar-top", 21],
  ["missile-pink-brinstar-bottom", 22],
  ["charge-beam", 23],
  ["power-bomb-pink-brinstar", 24],
  ["missile-green-brinstar-pipe", 25],
  ["morphing-ball", 26],
  ["power-bomb-blue-brinstar", 27],
  ["missile-blue-brinstar-middle", 28],
  ["energy-tank-brinstar-ceiling", 29],
  ["energy-tank-etecoons", 30],
  ["super-missile-green-brinstar-bottom", 31],
  ["energy-tank-waterway", 33],
  ["missile-blue-brinstar-bottom", 34],
  ["energy-tank-brinstar-gate", 35],
  ["missile-blue-brinstar-top", 36],
  ["missile-blue-brinstar-behind-missile", 37],
  ["x-ray-scope", 38],
  ["power-bomb-red-brinstar-sidehopper-room", 39],
  ["power-bomb-red-brinstar-spike-room", 40],
  ["missile-red-brinstar-spike-room", 41],
  ["spazer", 42],
  ["energy-tank-kraid", 43],
  ["missile-kraid", 44],
  ["varia-suit", 48],
  ["missile-lava-room", 49],
  ["ice-beam", 50],
  ["missile-below-ice-beam", 51],
  ["energy-tank-crocomire", 52],
  ["hi-jump-boots", 53],
  ["missile-above-crocomire", 54],
  ["missile-hi-jump-boots", 55],
  ["energy-tank-hi-jump-boots", 56],
  ["power-bomb-crocomire", 57],
  ["missile-below-crocomire", 58],
  ["missile-grappling-beam", 59],
  ["grappling-beam", 60],
  ["reserve-tank-norfair", 61],
  ["missile-norfair-reserve-tank", 62],
  ["missile-bubble-norfair-green-door", 63],
  ["missile-bubble-norfair", 64],
  ["missile-speed-booster", 65],
  ["speed-booster", 66],
  ["missile-wave-beam", 67],
  ["wave-beam", 68],
  ["missile-gold-torizo", 70],
  ["super-missile-gold-torizo", 71],
  ["missile-mickey-mouse-room", 73],
  ["missile-lower-norfair-above-fire-flea-room", 74],
  ["power-bomb-lower-norfair-above-fire-flea-room", 75],
  ["power-bomb-power-bombs-of-shame", 76],
  ["missile-lower-norfair-near-wave-beam", 77],
  ["energy-tank-ridley", 78],
  ["screw-attack", 79],
  ["energy-tank-firefleas", 80],
  ["missile-wrecked-ship-middle", 128],
  ["reserve-tank-wrecked-ship", 129],
  ["missile-gravity-suit", 130],
  ["missile-wrecked-ship-top", 131],
  ["energy-tank-wrecked-ship", 132],
  ["super-missile-wrecked-ship-left", 133],
  ["right-super-wrecked-ship", 134],
  ["gravity-suit", 135],
  ["missile-green-maridia-shinespark", 136],
  ["super-missile-green-maridia", 137],
  ["energy-tank-mama-turtle", 138],
  ["missile-green-maridia-tatori", 139],
  ["super-missile-yellow-maridia", 140],
  ["missile-yellow-maridia-super-missile", 141],
  ["missile-yellow-maridia-false-wall", 142],
  ["plasma-beam", 143],
  ["missile-left-maridia-sand-pit-room", 144],
  ["reserve-tank-maridia", 145],
  ["missile-right-maridia-sand-pit-room", 146],
  ["power-bomb-right-maridia-sand-pit-room", 147],
  ["missile-pink-maridia", 148],
  ["super-missile-pink-maridia", 149],
  ["spring-ball", 150],
  ["missile-draygon", 151],
  ["energy-tank-botwoon", 152],
  ["space-jump", 154],
]);
