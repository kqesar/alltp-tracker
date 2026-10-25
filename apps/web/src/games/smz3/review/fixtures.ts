// The real spoiler log of samus.link that the pack keeps as fixtures
// (packs/smz3/test/spoilers/, recorded by its script, never edited), for the
// app's specs: the Download's text (rebuilt from the API with the site's own
// code, its provenance says so) and the API's JSON.

import { parseSpoiler } from "@alltp/pack-smz3";
import type { Smz3SpoilerLog } from "@/games/smz3/review/labels";
import api from "../../../../../../packs/smz3/test/spoilers/hQa77ywrRDKvN4tXHGyRMw.json?raw";
import yaml from "../../../../../../packs/smz3/test/spoilers/hQa77ywrRDKvN4tXHGyRMw.txt?raw";

/** The seed's guid, which the log carries and the ROM states. */
export const GUID = "8506bbef2c2b4432af378b571c6c9133";

/** The name the site gives the Download. */
export const SPOILER_NAME =
  "Super Metroid & A Link to the Past Combo Randomizer v11.3.2 - hQa77ywrRDKvN4tXHGyRMw - Spoiler.txt";

/** The file as the seed page's Download writes it. */
export const spoilerText = (): string => yaml;

/** The file the player would pick. */
export const spoilerFile = (): File =>
  new File([yaml], SPOILER_NAME, { type: "text/plain" });

/** The API's answer, which a player may have saved instead. */
export const apiFile = (): File =>
  new File([api], "hQa77ywrRDKvN4tXHGyRMw.json", { type: "application/json" });

/** The log, parsed. */
export const spoilerLog = (): Smz3SpoilerLog => {
  const result = parseSpoiler(yaml, SPOILER_NAME);
  if (!result.ok) throw new Error(`fixture: ${result.error}`);
  return result.value;
};
