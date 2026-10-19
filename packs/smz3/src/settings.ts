// A run's settings, as samus.link sets them (Randomizer.SMZ3/Config.cs,
// RandomizerOptions.cs), and the settings the engine compiles a world with.
//
// Upstream's rules read the run's settings in three ways: Super Metroid's
// logic picks a rule (world.ts, `Rule`); keysanity and the Ganon's Tower
// thresholds are read inside rules; and a few dungeon rules ask what item
// sits at a location (`GetLocation(...).ItemIs(...)`), which a tracker does
// not know. Those placements are settings too: unknown in a run, so a rule
// that hangs on one reads as maybe, and set as the logic tests place them.

import type { Settings } from "@alltp/engine";
import { locationId } from "./world";

export interface Smz3Settings {
  /** Super Metroid's logic: Normal or Hard (Config.SMLogic). */
  readonly smLogic: "normal" | "hard";
  /** Keys, big keys and keycards anywhere (KeyShuffle.Keysanity). */
  readonly keysanity: boolean;
  /** Crystals that open Ganon's Tower (OpenTower, 0-7). */
  readonly towerCrystals: number;
  /** Crystals that make Ganon vulnerable (GanonVulnerable, 0-7). */
  readonly ganonCrystals: number;
  /** Super Metroid bosses that open Tourian (OpenTourian, 0-4). */
  readonly tourianBosses: number;
}

/** samus.link's defaults (RandomizerOptions.cs): Normal, 7/7/4. */
export const DEFAULT_SETTINGS: Smz3Settings = {
  ganonCrystals: 7,
  keysanity: false,
  smLogic: "normal",
  tourianBosses: 4,
  towerCrystals: 7,
};

/**
 * A rule that asks what sits at a location: the setting it reads, and the
 * placement it stands for. Every one upstream's region code asks.
 */
export interface Placement {
  readonly setting: string;
  /** Upstream's location name. */
  readonly location: string;
  /** Upstream's item type. */
  readonly item: string;
}

const placement = (setting: string, location: string, item: string) => ({
  item,
  location,
  setting,
});

const gt = (room: string, corner: string, item: string) =>
  placement(
    `gt${room.replace(/ /g, "")}${corner.replace(/ /g, "")}${item}`,
    `Ganon's Tower - ${room} - ${corner}`,
    item,
  );

const CORNERS = ["Top Left", "Top Right", "Bottom Left", "Bottom Right"];

export const PLACEMENTS: readonly Placement[] = [
  placement(
    "podBigKeyChestKeyPD",
    "Palace of Darkness - Big Key Chest",
    "KeyPD",
  ),
  placement(
    "podHarmlessHellwayKeyPD",
    "Palace of Darkness - Harmless Hellway",
    "KeyPD",
  ),
  placement("ttBigChestKeyTT", "Thieves' Town - Big Chest", "KeyTT"),
  placement("ipSpikeRoomBigKeyIP", "Ice Palace - Spike Room", "BigKeyIP"),
  placement("ipMapChestBigKeyIP", "Ice Palace - Map Chest", "BigKeyIP"),
  placement("ipBigKeyChestBigKeyIP", "Ice Palace - Big Key Chest", "BigKeyIP"),
  placement("mmBigKeyChestBigKeyMM", "Misery Mire - Big Key Chest", "BigKeyMM"),
  placement(
    "mmCompassChestBigKeyMM",
    "Misery Mire - Compass Chest",
    "BigKeyMM",
  ),
  placement("trBigKeyChestBigKeyTR", "Turtle Rock - Big Key Chest", "BigKeyTR"),
  placement("trBigKeyChestKeyTR", "Turtle Rock - Big Key Chest", "KeyTR"),
  placement("gtMapChestBigKeyGT", "Ganon's Tower - Map Chest", "BigKeyGT"),
  placement("gtMapChestKeyGT", "Ganon's Tower - Map Chest", "KeyGT"),
  placement("gtFiresnakeRoomKeyGT", "Ganon's Tower - Firesnake Room", "KeyGT"),
  ...CORNERS.map((corner) => gt("Randomizer Room", corner, "BigKeyGT")),
  ...CORNERS.map((corner) => gt("Compass Room", corner, "BigKeyGT")),
];

/** The setting of a placement upstream's rules ask about. */
export function placementSetting(location: string, item: string): string {
  const found = PLACEMENTS.find(
    (p) => p.location === location && p.item === item,
  );
  if (found === undefined) {
    throw new RangeError(`No rule asks for ${item} at ${location}`);
  }
  return found.setting;
}

/** The ids of the locations a placement setting is about, for the UI. */
export const PLACEMENT_LOCATIONS: ReadonlySet<string> = new Set(
  PLACEMENTS.map(({ location }) => locationId(location)),
);

/**
 * The engine's settings for a run: keysanity, Ganon's Tower's thresholds
 * and every placement, unknown. `rewardsPlaced` is false only in a world
 * whose bosses hold no reward, as upstream's logic tests set it up
 * (World.CanAcquire: "if no region has the reward then CanAcquire is
 * satisfied").
 * @param placed - Placements known, by setting (the logic tests')
 */
export function engineSettings(
  settings: Smz3Settings,
  {
    placed,
    rewardsPlaced = true,
  }: {
    placed?: ReadonlySet<string>;
    rewardsPlaced?: boolean;
  } = {},
): Settings {
  const placements: Record<string, boolean | { unknown: true }> = {};
  for (const { setting } of PLACEMENTS) {
    placements[setting] =
      placed === undefined ? { unknown: true } : placed.has(setting);
  }
  return {
    ...placements,
    // GanonsTower.cs CanEnter: (TourianBossTokens * TowerCrystals) / 7 tokens
    gtBossTokens: Math.floor(
      (settings.tourianBosses * settings.towerCrystals) / 7,
    ),
    keysanity: settings.keysanity,
    rewardsPlaced,
    towerCrystals: settings.towerCrystals,
  };
}
