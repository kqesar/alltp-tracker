import type { SpoilerFormat, SpoilerGame } from "./model";

/** What `sniffSpoiler` made of a file's head. */
export type Sniffed =
  | {
      readonly known: true;
      readonly game: SpoilerGame;
      /** The layout where the head tells it; null when only the pack's parse can (vt or er). */
      readonly format: SpoilerFormat | null;
    }
  | {
      readonly known: false;
      /**
       * `archipelago` and `smz3-sm` (samus.link's Super Metroid) are real
       * spoilers the tracker does not read; `rom` is a binary or a ROM;
       * `unknown` is anything else.
       */
      readonly what: "archipelago" | "smz3-sm" | "rom" | "unknown";
    };

const ROM_NAME = /\.(?:sfc|smc|fig|swc|zip|7z|ips|bps)$/i;
const ARCHIPELAGO = /^Archipelago Version \d/;
// Map Rando writes these top-level keys before its heavy ones; any of them is
// enough, and the playthrough's first step is a second witness.
const MAP_RANDO =
  /"(?:item_priority|all_items|start_location|missile_size)"\s*:|"summary"\s*:\s*\[\s*\{\s*"step"/;
// An alttpr.com log starts with its meta; the S3 seed file with its logic
// number and patch.
const ALTTPR_JSON = /^\{\s*(?:"meta"\s*:|"logic"\s*:\s*\d+\s*,\s*"patch"\s*:)/;
const ALTTPR_NAME = /^alttpr - /i;
// The Door Randomizer's text log opens with its meta_to_file line, its
// Overworld fork's with its own (DR 1.5.8 BaseClasses.py:2761, OWR 0.8.0.0
// :3335). Its JSON (Spoiler.to_json, :2718) leads with the entrance and door
// lists, which may run past any head, so a JSON one is told by the keys only
// DR writes, or by the name a site saves it under: avianart's Download
// Spoiler (`alttprcustom - DR__<hash>_Spoiler.txt`) or DR's own output
// (`DR_<seed>_Spoiler.txt`, `OR_…`).
const DOOR_TEXT =
  /^ALttP (?:Dungeon Randomizer Version \S+|Overworld Randomizer)\s+-\s+Seed: /;
const DOOR_JSON_KEYS = /"(?:Doors|Lobbies|DoorTypes|Whirlpools)"\s*:\s*\[/;
const DOOR_NAME = /^(?:alttprcustom - )?(?:DR|OR)_/i;
// samus.link's site writes `- <title>` as a YAML sequence, its API `Game: <title>`.
const SAMUS_LINK_TITLE = /^(?:- |Game: )(SMZ3|SM) \d/;
const SAMUS_LINK_API = /^\{\s*"seed"\s*:\s*\{/;
const BYTE_ORDER_MARK = "﻿";

/**
 * Which randomizer wrote a file, from its first `SNIFF_HEAD_LENGTH`
 * characters and its name. Only the head is read, so it costs nothing on a
 * 21 MB file; it decides nothing about whether the file is sound, which is
 * the pack's parse. samus.link's API JSON keeps its game after the spoiler
 * text, past any head, so it reads as SMZ3 and the pack refuses a Super
 * Metroid one.
 */
export function sniffSpoiler(head: string, fileName = ""): Sniffed {
  if (head.includes("\0") || head.includes("�") || ROM_NAME.test(fileName)) {
    return { known: false, what: "rom" };
  }
  const text = (
    head.startsWith(BYTE_ORDER_MARK) ? head.slice(1) : head
  ).trimStart();
  if (ARCHIPELAGO.test(text)) return { known: false, what: "archipelago" };
  if (DOOR_TEXT.test(text)) {
    return { format: "dr", game: "alttpr", known: true };
  }
  const title = SAMUS_LINK_TITLE.exec(text);
  if (title) {
    return title[1] === "SM"
      ? { known: false, what: "smz3-sm" }
      : { format: "smz3-yaml", game: "smz3", known: true };
  }
  if (text.startsWith("{")) {
    if (SAMUS_LINK_API.test(text)) {
      return /"gameId"\s*:\s*"sm"/.test(text)
        ? { known: false, what: "smz3-sm" }
        : { format: "smz3-api", game: "smz3", known: true };
    }
    if (DOOR_JSON_KEYS.test(text) || DOOR_NAME.test(fileName)) {
      return { format: "dr", game: "alttpr", known: true };
    }
    if (ALTTPR_JSON.test(text)) {
      return { format: null, game: "alttpr", known: true };
    }
    if (MAP_RANDO.test(text)) {
      return { format: "map-rando", game: "sm", known: true };
    }
    if (ALTTPR_NAME.test(fileName)) {
      return { format: null, game: "alttpr", known: true };
    }
  }
  return { known: false, what: "unknown" };
}
