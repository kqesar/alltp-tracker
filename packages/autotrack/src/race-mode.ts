// The Race Mode switch: the user's setting plus what the ROM's race flag
// says. Fails closed: until the flag has been read, or when it cannot be,
// "auto" means Race Mode on.

/** The user's choice. "off" over a race ROM is an override the UI flags. */
export type RaceSetting = "auto" | "on" | "off";

/** What is known of the ROM's race flag. */
export type RaceFlagState =
  /** Not read yet on this device. */
  | "pending"
  | "race"
  | "open"
  /** Read, but the value means neither. */
  | "unknown"
  /** This device cannot read ROM (QUsb2Snes says NO_ROM_READ). */
  | "unreadable"
  /** The pack declares no flag: the game has none. */
  | "none";

export interface RaceStatus {
  readonly setting: RaceSetting;
  readonly flag: RaceFlagState;
  /** Race Mode in effect: only permitted ranges are read. */
  readonly active: boolean;
  /**
   * The user turned Race Mode off although the flag does not say "open".
   * A UI that offers it should warn; the app never does.
   */
  readonly overridden: boolean;
  /**
   * Every read the scheduler issues is permitted by the race profile: Race
   * Mode is on, or the pack reads nothing a race forbids.
   */
  readonly raceLegal: boolean;
}

export function raceStatus(
  setting: RaceSetting,
  flag: RaceFlagState,
  readsForbidden: boolean,
): RaceStatus {
  const flagAllowsCasual = flag === "open" || flag === "none";
  const active = setting === "on" || (setting === "auto" && !flagAllowsCasual);
  return {
    active,
    flag,
    overridden: setting === "off" && !flagAllowsCasual,
    raceLegal: active || !readsForbidden,
    setting,
  };
}
