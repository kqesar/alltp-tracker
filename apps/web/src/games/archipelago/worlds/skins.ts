// The worlds the board draws with art. Every other world, and any world
// whose skin is missing here, gets the generic list.

import { ALTTP_SKIN } from "@/games/archipelago/worlds/alttp";
import type { Skin } from "@/games/archipelago/worlds/skin";

const SKINS: readonly Skin[] = [ALTTP_SKIN];

/** The skin of a world, by the name the room gives its game. */
export const skinFor = (game: string | undefined): Skin | null =>
  SKINS.find((skin) => skin.game === game) ?? null;
