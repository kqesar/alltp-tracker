// app/World/Inverted.php: the regions of an Inverted world (29-54), each
// its own class (Inverted's escape extends Open's, the others Standard's), and
// Standard's Medallions and Fountains.

import { INVERTED_DARK_WORLD_DEATH_MOUNTAIN_EAST } from "../regions/inverted/dark-world/death-mountain/east";
import { INVERTED_DARK_WORLD_DEATH_MOUNTAIN_WEST } from "../regions/inverted/dark-world/death-mountain/west";
import { INVERTED_DARK_WORLD_MIRE } from "../regions/inverted/dark-world/mire";
import { INVERTED_DARK_WORLD_NORTH_EAST } from "../regions/inverted/dark-world/north-east";
import { INVERTED_DARK_WORLD_NORTH_WEST } from "../regions/inverted/dark-world/north-west";
import { INVERTED_DARK_WORLD_SOUTH } from "../regions/inverted/dark-world/south";
import { INVERTED_DESERT_PALACE } from "../regions/inverted/desert-palace";
import { INVERTED_EASTERN_PALACE } from "../regions/inverted/eastern-palace";
import { INVERTED_GANONS_TOWER } from "../regions/inverted/ganons-tower";
import { INVERTED_HYRULE_CASTLE_ESCAPE } from "../regions/inverted/hyrule-castle-escape";
import { INVERTED_HYRULE_CASTLE_TOWER } from "../regions/inverted/hyrule-castle-tower";
import { INVERTED_ICE_PALACE } from "../regions/inverted/ice-palace";
import { INVERTED_LIGHT_WORLD_DEATH_MOUNTAIN_EAST } from "../regions/inverted/light-world/death-mountain/east";
import { INVERTED_LIGHT_WORLD_DEATH_MOUNTAIN_WEST } from "../regions/inverted/light-world/death-mountain/west";
import { INVERTED_LIGHT_WORLD_NORTH_EAST } from "../regions/inverted/light-world/north-east";
import { INVERTED_LIGHT_WORLD_NORTH_WEST } from "../regions/inverted/light-world/north-west";
import { INVERTED_LIGHT_WORLD_SOUTH } from "../regions/inverted/light-world/south";
import { INVERTED_MISERY_MIRE } from "../regions/inverted/misery-mire";
import { INVERTED_PALACE_OF_DARKNESS } from "../regions/inverted/palace-of-darkness";
import { INVERTED_SKULL_WOODS } from "../regions/inverted/skull-woods";
import { INVERTED_SWAMP_PALACE } from "../regions/inverted/swamp-palace";
import { INVERTED_THIEVES_TOWN } from "../regions/inverted/thieves-town";
import { INVERTED_TOWER_OF_HERA } from "../regions/inverted/tower-of-hera";
import { INVERTED_TURTLE_ROCK } from "../regions/inverted/turtle-rock";
import { FOUNTAINS } from "../regions/standard/fountains";
import { MEDALLIONS } from "../regions/standard/medallions";
import type { RegionModule } from "../world";

/** Every region module of an Inverted world, in World/Inverted.php's order. */
export const INVERTED_REGIONS: readonly RegionModule[] = [
  INVERTED_LIGHT_WORLD_NORTH_EAST,
  INVERTED_LIGHT_WORLD_NORTH_WEST,
  INVERTED_LIGHT_WORLD_SOUTH,
  INVERTED_HYRULE_CASTLE_ESCAPE,
  INVERTED_EASTERN_PALACE,
  INVERTED_DESERT_PALACE,
  INVERTED_LIGHT_WORLD_DEATH_MOUNTAIN_WEST,
  INVERTED_LIGHT_WORLD_DEATH_MOUNTAIN_EAST,
  INVERTED_TOWER_OF_HERA,
  INVERTED_HYRULE_CASTLE_TOWER,
  INVERTED_DARK_WORLD_DEATH_MOUNTAIN_EAST,
  INVERTED_DARK_WORLD_DEATH_MOUNTAIN_WEST,
  INVERTED_DARK_WORLD_NORTH_EAST,
  INVERTED_DARK_WORLD_NORTH_WEST,
  INVERTED_DARK_WORLD_SOUTH,
  INVERTED_DARK_WORLD_MIRE,
  INVERTED_PALACE_OF_DARKNESS,
  INVERTED_SWAMP_PALACE,
  INVERTED_SKULL_WOODS,
  INVERTED_THIEVES_TOWN,
  INVERTED_ICE_PALACE,
  INVERTED_MISERY_MIRE,
  INVERTED_TURTLE_ROCK,
  INVERTED_GANONS_TOWER,
  MEDALLIONS,
  FOUNTAINS,
];
