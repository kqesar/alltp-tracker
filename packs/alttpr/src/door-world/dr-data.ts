// The Door Randomizer's world as import-dr.mjs wrote it (src/door-rando/
// world/*.json), at the release upstream.json pins: a bundle of its own,
// which drWorld builds on (`options.data`). Its own module, so only a DR run
// downloads it, never an Overworld Randomizer run (owr-data.ts).
import connectionData from "../door-rando/world/connections.json" with {
  type: "json",
};
import doorData from "../door-rando/world/doors.json" with { type: "json" };
import entranceData from "../door-rando/world/entrances.json" with {
  type: "json",
};
import regionData from "../door-rando/world/regions.json" with { type: "json" };
import ruleData from "../door-rando/world/rules.json" with { type: "json" };
import { type DrData, drDataOf } from "./data";

/** The Door Randomizer's world at the release upstream.json pins. */
export const DR_DATA: DrData = drDataOf("dr", {
  doors: doorData,
  regions: regionData,
  rules: ruleData,
  tables: [connectionData, entranceData],
});
