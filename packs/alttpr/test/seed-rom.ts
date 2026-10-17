// A seed's settings written into a memory image as alttpr.com writes them
// into its ROM, for the specs and browser tests of autotracking: the bytes of
// vt app/World.php:writeToRom (1110-1345) at 219fcafd, in the FX Pak Pro
// space the bridges serve. The decoder's own spec builds its images byte by
// byte instead, so the two are checked against each other.

import { MEMORY_RANGE } from "../src/autotrack/memory";
import type {
  SeedGoal,
  SeedLogic,
  SeedMode,
} from "../src/autotrack/seed-settings";

/** A seed's settings under vt's own names; omitted, the site's default. */
export type SeedRom = {
  readonly mode?: SeedMode;
  readonly swordless?: boolean;
  readonly goal?: SeedGoal;
  readonly crystalsTower?: number;
  readonly crystalsGanon?: number;
  readonly dungeonItems?: "standard" | "mc" | "mcs" | "full";
  readonly logic?: SeedLogic;
};

/** The free item menu's bits for each dungeonItems (World.php:111-129). */
const MENU = { full: 0x0f, mc: 0x0c, mcs: 0x0d, standard: 0x00 } as const;

/** GanonVulnerableMode for each goal (World.php:1193-1219, Rom.php:584-626). */
const VULNERABLE: Readonly<Record<SeedGoal, number>> = {
  completionist: 0x0b,
  dungeons: 0x02,
  fast_ganon: 0x04,
  ganon: 0x04,
  ganonhunt: 0x05,
  pedestal: 0x01,
  "triforce-hunt": 0x01,
};

/** Triforce pieces each goal asks for (config/alttp.php:31-53). */
const PIECES: Partial<Record<SeedGoal, number>> = {
  ganonhunt: 40,
  "triforce-hunt": 20,
};

const SEED_TYPE: Readonly<Record<SeedLogic, number>> = {
  MajorGlitches: 0x01,
  NoGlitches: 0x00,
  OverworldGlitches: 0x02,
};

/**
 * Write a seed's settings into a memory image, as alttpr.com's ROM holds
 * them.
 * @param memory - A 16 MiB FX Pak Pro image
 * @param seed - The settings; each one left out is the site's default
 *   (config/alttp.php:78-96): Open, swords, Ganon, 7 and 7 crystals,
 *   dungeon items in their dungeons, no glitches
 */
export const writeSeedSettings = (
  memory: Uint8Array,
  {
    crystalsGanon = 7,
    crystalsTower = 7,
    dungeonItems = "standard",
    goal = "ganon",
    logic = "NoGlitches",
    mode = "open",
    swordless = false,
  }: SeedRom = {},
): Uint8Array => {
  const at = (id: keyof typeof MEMORY_RANGE) => MEMORY_RANGE[id].address;
  const sword = swordless ? 0x01 : 0x00;
  memory[at("swordless-mode")] = sword;
  memory[at("swordless-mode") + 2] = sword;
  memory[at("dungeon-item-menu")] = MENU[dungeonItems];
  memory[at("inverted-mode")] = mode === "inverted" ? 0x01 : 0x00;
  const pieces = PIECES[goal] ?? 0;
  memory[at("goal-items")] = pieces & 0xff;
  memory[at("goal-items") + 1] = pieces >> 8;
  memory[at("generic-keys")] = mode === "retro" ? 0x01 : 0x00;
  memory[at("tower-crystals")] = crystalsTower;
  memory[at("ganon-crystals")] = crystalsGanon;
  memory[at("ganon-vulnerable")] = VULNERABLE[goal];
  memory[at("seed-type")] = SEED_TYPE[logic];
  memory[at("initial-pyramid")] =
    goal === "fast_ganon" || goal === "ganonhunt" ? 0x20 : 0x00;
  memory[at("initial-progress")] = mode === "standard" ? 0x00 : 0x02;
  return memory;
};
