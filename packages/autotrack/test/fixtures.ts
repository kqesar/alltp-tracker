// A small pack in the shape the ALttPR pack will take, under the real race
// profile. Its addresses are test data, not the ALttPR memory map.

import { ALTTPR_RACE_PROFILE } from "../../../packs/alttpr/src/autotrack/race-profile";
import { bus } from "../src/address";
import { type AutotrackPackSource, definePack } from "../src/pack";

export const TITLE = "THE LEGEND OF ZELDA  ";

export const SAMPLE_SOURCE: AutotrackPackSource = {
  gameCheck: {
    ranges: ["header"],
    verify: (bytes) => {
      const title = String.fromCharCode(...bytes("header"));
      return title === TITLE
        ? { ok: true }
        : {
            code: "not-alttp",
            message: "The running game is not A Link to the Past.",
            ok: false,
          };
    },
  },
  id: "sample",
  profile: ALTTPR_RACE_PROFILE,
  ranges: [
    {
      address: bus(0x00_ffc0),
      category: "rom-header",
      id: "header",
      size: 0x15,
    },
    {
      address: bus(0x7e_0010),
      category: "game-start",
      everyMs: 250,
      id: "module",
      size: 1,
    },
    {
      address: bus(0x7e_f340),
      category: "items",
      everyMs: 500,
      id: "items",
      size: 0x1c,
    },
    {
      address: bus(0x7e_f35c),
      category: "hud",
      everyMs: 500,
      id: "bottles",
      size: 4,
    },
    {
      address: bus(0x7e_f364),
      category: "items",
      everyMs: 500,
      id: "items-more",
      size: 0x10,
    },
    {
      address: bus(0x7e_f280),
      category: "outside-checks",
      everyMs: 1000,
      id: "overworld",
      size: 0x80,
    },
    {
      address: bus(0x7e_f4c0),
      category: "dungeon-checks",
      everyMs: 1000,
      id: "dungeon-counts",
      size: 0x10,
    },
    {
      address: bus(0x7e_1000),
      category: "entrances",
      everyMs: 1000,
      id: "entrances",
      size: 0x40,
    },
  ],
};

export const SAMPLE_PACK = definePack(SAMPLE_SOURCE);

/** Writes a booted game into an FX Pak Pro memory image. */
export function bootGame(
  memory: Uint8Array,
  options: { race?: boolean } = {},
): void {
  const header = bus(0x00_ffc0);
  for (let i = 0; i < TITLE.length; i++)
    memory[header + i] = TITLE.charCodeAt(i);
  memory[bus(0x30_8213)] = options.race ? 0x01 : 0x00;
  memory[bus(0x7e_0010)] = 0x07;
}
