// The bosses the player knows under boss shuffle: each grid dungeon's
// `knownbossN` cell, 0 while not known, then the pack's SHUFFLED_BOSSES in
// order from 1 (Armos Knights) to 10 (Trinexx). The pack reads it
// (`TrackerInput.bosses`, logic/packItems.ts) and its slot's rule becomes
// that boss's own. Only the bosses the slot can hold are offered, and only
// while the run's bosses may move (`bossesMayMove`). Ganon's Tower's three
// have no cell yet: they stay read as any boss their slot may hold.
import {
  type BossPlaceId,
  bossesAt,
  bossPlaceOf,
  LEGACY_DUNGEONS,
  SHUFFLED_BOSSES,
  type ShuffledBoss,
} from "@alltp/pack-alttpr";
import {
  bossesMayMove,
  isHidden,
  type RunSettings,
} from "@/games/alttpr/data/presets";
import { dungeonName } from "@/games/alttpr/logic/settings";

/** The cells' prefix: `knownboss0` is Eastern Palace's. */
export const KNOWN_BOSS = "knownboss";

/** The cell of a grid dungeon's boss, by its index (0-9). */
export const knownBossCell = (index: number) => `${KNOWN_BOSS}${index}`;

/** The grid dungeon index of a known boss's cell, or null for another id. */
export const knownBossIndex = (id: string): number | null => {
  const match = /^knownboss(\d)$/.exec(id);
  return match ? Number(match[1]) : null;
};

/** A grid dungeon's boss slot, by index (0-9). */
export const placeAt = (index: number): BossPlaceId => {
  const place = bossPlaceOf(LEGACY_DUNGEONS[index]);
  if (place === undefined) throw new RangeError(`No boss slot at ${index}`);
  return place;
};

/** The boss a cell's value names, or undefined for 0 (not known). */
export const bossOfValue = (value: number): ShuffledBoss | undefined =>
  SHUFFLED_BOSSES[value - 1];

/** The value that names a boss. */
export const valueOfBoss = (boss: ShuffledBoss): number =>
  SHUFFLED_BOSSES.indexOf(boss) + 1;

/** Whether the run is swordless, as far as the player knows it. */
const swordless = (settings: RunSettings) =>
  settings.swordless && !isHidden(settings, "swordless");

/**
 * Whether a dungeon's known boss is the player's to tell: the run's bosses
 * may move, and it is not a swordless Ice Palace, whose Kholdstare never
 * moves (Randomizer.php:380-383).
 */
export const knownBossShown = (index: number, settings: RunSettings) =>
  bossesMayMove(settings) &&
  !(placeAt(index) === "icePalace" && swordless(settings));

/**
 * The values a dungeon's cell may take: not known, then each boss its slot
 * can hold, Kholdstare left out of a known swordless run but in Ice Palace.
 */
export const knownBossValues = (
  index: number,
  settings: RunSettings,
): readonly number[] => [
  0,
  ...bossesAt(placeAt(index))
    .filter((boss) => boss !== "kholdstare" || !swordless(settings))
    .map(valueOfBoss),
];

/**
 * The next value a click (1) or a right-click (-1) gives a cell, round the
 * values it may take; a value it may not take steps from not known.
 */
export const stepKnownBoss = (
  index: number,
  value: number,
  settings: RunSettings,
  direction: 1 | -1,
): number => {
  const values = knownBossValues(index, settings);
  const at = Math.max(0, values.indexOf(value));
  return values[(at + direction + values.length) % values.length] ?? 0;
};

/** Each boss's name, as the game's community writes it. */
export const BOSS_LABELS: Readonly<Record<ShuffledBoss, string>> = {
  armosKnights: "Armos Knights",
  arrghus: "Arrghus",
  blind: "Blind the Thief",
  helmasaurKing: "Helmasaur King",
  kholdstare: "Kholdstare",
  lanmolas: "Lanmolas",
  moldorm: "Moldorm",
  mothula: "Mothula",
  trinexx: "Trinexx",
  vitreous: "Vitreous",
};

/** A cell's value in words: a boss's name, or "unknown". */
export const knownBossText = (value: number) => {
  const boss = bossOfValue(value);
  return boss === undefined ? "unknown" : BOSS_LABELS[boss];
};

/** The boss a grid dungeon holds in the vanilla game, by its index (0-9). */
const vanillaBoss = (index: number): ShuffledBoss | undefined =>
  SHUFFLED_BOSSES[index];

/** What a boss's name is read from: the run's cells and its settings. */
export interface BossNaming {
  readonly items: Readonly<Record<string, number | boolean>>;
  readonly settings: RunSettings;
}

/**
 * What to call the boss of a grid dungeon (0-9), the one rule every text
 * follows: its vanilla boss while the run's bosses stay home (and Ice
 * Palace's Kholdstare in a swordless run, which never moves); once they may
 * move, the boss the player has marked or autotracking has seen, else
 * neutral, "<Dungeon> boss". It never guesses the vanilla boss of a slot
 * that may hold another, which in Race Mode (it shows no boss before it
 * falls, and the tracker is not told after) would tell what the rules keep
 * from the player.
 */
export const bossName = (index: number, run: BossNaming): string => {
  const known = knownBossShown(index, run.settings)
    ? bossOfValue(Number(run.items[knownBossCell(index)] ?? 0))
    : vanillaBoss(index);
  return known === undefined
    ? `${dungeonName(index)} boss`
    : BOSS_LABELS[known];
};
