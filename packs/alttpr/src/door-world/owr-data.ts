// The Overworld Randomizer's world (codemann8's fork of DR) as import-dr.mjs
// --owr wrote it (src/door-rando/owr/*.json), at the release upstream.json
// pins (doorRandomizer.overworld): a bundle of its own, which drWorld builds
// on (`options.data`). Its own module, so only an OWR run downloads it.
import connectionData from "../door-rando/owr/connections.json" with {
  type: "json",
};
import doorData from "../door-rando/owr/doors.json" with { type: "json" };
import overworldData from "../door-rando/owr/overworld.json" with {
  type: "json",
};
import regionData from "../door-rando/owr/regions.json" with { type: "json" };
import ruleData from "../door-rando/owr/rules.json" with { type: "json" };
import { type DrData, drDataOf } from "./data";

/** The Overworld Randomizer's world at the release upstream.json pins. */
export const OWR_DATA: DrData = drDataOf("owr", {
  doors: doorData,
  overworld: overworldData,
  regions: regionData,
  rules: ruleData,
  tables: [connectionData],
});
