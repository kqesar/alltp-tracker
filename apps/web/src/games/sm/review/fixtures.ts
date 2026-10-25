// The real Map Rando spoiler log the pack keeps as a fixture
// (packs/sm/test/spoilers/, cut from seed dsjF6gGsH's 21 MB file by its
// script, never edited), for the app's specs.

import { type MapRandoLog, parseSpoiler } from "@alltp/pack-sm";
import fixture from "../../../../../../packs/sm/test/spoilers/dsjF6gGsH.json?raw";

/** The file as the web app's run would pick it. */
export const spoilerText = (): string => fixture;

/** The file the player would pick. */
export const spoilerFile = (name = "spoiler.json"): File =>
  new File([fixture], name, { type: "application/json" });

/** The log, parsed. */
export const spoilerLog = (): MapRandoLog => {
  const result = parseSpoiler(fixture, "spoiler.json");
  if (!result.ok) throw new Error(`fixture: ${result.error}`);
  return result.value;
};
