// Super Metroid as Archipelago names its items: AP's world is VARIA's
// randomizer, not Map Rando, so its names are VARIA's (`Morph Ball`,
// `Grappling Beam`, `Bomb`), drawn with the frames of Map Rando's item sheet
// the tracker's SM board uses (games/sm). Only art is shared with packs/sm.
// Read from AP 0.6.8's worlds/sm (commit 54803be0,
// packages/archipelago/upstream.json): `item_name_to_id` in __init__.py over
// VARIA's ItemManager.Items (variaRandomizer/rando/Items.py); held to the
// pinned name data by sm.spec.ts.
//
// The location groups are VARIA's graph areas (`GraphArea` of each location
// in variaRandomizer/graph/location.py), the world naming none of its own;
// the boss locations, which carry no item id, left out.

import { counter, SM_LAYOUT, toggle } from "@/games/archipelago/worlds/cells";
import type { ItemCell, Skin } from "@/games/archipelago/worlds/skin";
import GROUPS from "@/games/archipelago/worlds/sm-groups.json";
import { SPRITE_FRAME } from "@/games/sm/data";

/** A frame of Map Rando's item sheet. */
const frame = (id: keyof typeof SPRITE_FRAME) => ({ frame: SPRITE_FRAME[id] });

/** The 21 items, by VARIA's names; SM_LAYOUT places them. */
const CELLS: readonly ItemCell[] = [
  toggle("charge", "Charge Beam", frame("charge")),
  toggle("ice", "Ice Beam", frame("ice")),
  toggle("wave", "Wave Beam", frame("wave")),
  toggle("spazer", "Spazer", frame("spazer")),
  toggle("plasma", "Plasma Beam", frame("plasma")),
  toggle("xray", "X-Ray Scope", frame("xRay")),
  toggle("grapple", "Grappling Beam", frame("grapple")),
  toggle("morph", "Morph Ball", frame("morph")),
  toggle("bombs", "Bomb", frame("bombs")),
  toggle("springball", "Spring Ball", frame("springBall")),
  toggle("screw", "Screw Attack", frame("screwAttack")),
  toggle("varia", "Varia Suit", frame("varia")),
  toggle("gravity", "Gravity Suit", frame("gravity")),
  toggle("hijump", "Hi-Jump Boots", frame("hiJump")),
  toggle("spacejump", "Space Jump", frame("spaceJump")),
  toggle("speed", "Speed Booster", frame("speedBooster")),
  counter("etank", "Energy Tank", frame("energyTank")),
  counter("reserve", "Reserve Tank", frame("reserveTank")),
  counter("missile", "Missile", frame("missile")),
  counter("super", "Super Missile", frame("superMissile")),
  counter("pb", "Power Bomb", frame("powerBomb")),
];

export const SM_SKIN: Skin = {
  cells: CELLS,
  columns: 7,
  // Every item of the pool has its cell (VARIA classes all but Nothing and
  // No Energy as progression, the packs past the first few as filler)
  excluded: {
    Generic: "the ROM's stand-in for another world's item, never in the pool",
  },
  game: "Super Metroid",
  groups: Object.fromEntries(GROUPS as [string, string[]][]),
  layout: SM_LAYOUT,
};
