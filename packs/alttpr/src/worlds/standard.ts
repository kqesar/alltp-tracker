// app/World/Standard.php: the regions of a Standard world (27-54).

import { DARK_WORLD_DEATH_MOUNTAIN_EAST } from "../regions/standard/dark-world/death-mountain/east";
import { DARK_WORLD_DEATH_MOUNTAIN_WEST } from "../regions/standard/dark-world/death-mountain/west";
import { DARK_WORLD_MIRE } from "../regions/standard/dark-world/mire";
import { DARK_WORLD_NORTH_EAST } from "../regions/standard/dark-world/north-east";
import { DARK_WORLD_NORTH_WEST } from "../regions/standard/dark-world/north-west";
import { DARK_WORLD_SOUTH } from "../regions/standard/dark-world/south";
import { DESERT_PALACE } from "../regions/standard/desert-palace";
import { EASTERN_PALACE } from "../regions/standard/eastern-palace";
import { FOUNTAINS } from "../regions/standard/fountains";
import { GANONS_TOWER } from "../regions/standard/ganons-tower";
import { HYRULE_CASTLE_ESCAPE } from "../regions/standard/hyrule-castle-escape";
import { HYRULE_CASTLE_TOWER } from "../regions/standard/hyrule-castle-tower";
import { ICE_PALACE } from "../regions/standard/ice-palace";
import { LIGHT_WORLD_DEATH_MOUNTAIN_EAST } from "../regions/standard/light-world/death-mountain/east";
import { LIGHT_WORLD_DEATH_MOUNTAIN_WEST } from "../regions/standard/light-world/death-mountain/west";
import { LIGHT_WORLD_NORTH_EAST } from "../regions/standard/light-world/north-east";
import { LIGHT_WORLD_NORTH_WEST } from "../regions/standard/light-world/north-west";
import { LIGHT_WORLD_SOUTH } from "../regions/standard/light-world/south";
import { MEDALLIONS } from "../regions/standard/medallions";
import { MISERY_MIRE } from "../regions/standard/misery-mire";
import { PALACE_OF_DARKNESS } from "../regions/standard/palace-of-darkness";
import { SKULL_WOODS } from "../regions/standard/skull-woods";
import { SWAMP_PALACE } from "../regions/standard/swamp-palace";
import { THIEVES_TOWN } from "../regions/standard/thieves-town";
import { TOWER_OF_HERA } from "../regions/standard/tower-of-hera";
import { TURTLE_ROCK } from "../regions/standard/turtle-rock";
import type { RegionModule } from "../world";

/** Every region module of a Standard world, in World/Standard.php's order. */
export const STANDARD_REGIONS: readonly RegionModule[] = [
  LIGHT_WORLD_NORTH_EAST,
  LIGHT_WORLD_NORTH_WEST,
  LIGHT_WORLD_SOUTH,
  HYRULE_CASTLE_ESCAPE,
  EASTERN_PALACE,
  DESERT_PALACE,
  LIGHT_WORLD_DEATH_MOUNTAIN_WEST,
  LIGHT_WORLD_DEATH_MOUNTAIN_EAST,
  TOWER_OF_HERA,
  HYRULE_CASTLE_TOWER,
  DARK_WORLD_DEATH_MOUNTAIN_EAST,
  DARK_WORLD_DEATH_MOUNTAIN_WEST,
  DARK_WORLD_NORTH_EAST,
  DARK_WORLD_NORTH_WEST,
  DARK_WORLD_SOUTH,
  DARK_WORLD_MIRE,
  PALACE_OF_DARKNESS,
  SWAMP_PALACE,
  SKULL_WOODS,
  THIEVES_TOWN,
  ICE_PALACE,
  MISERY_MIRE,
  TURTLE_ROCK,
  GANONS_TOWER,
  MEDALLIONS,
  FOUNTAINS,
];
