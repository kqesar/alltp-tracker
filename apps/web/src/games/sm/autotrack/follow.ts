// The Super Metroid run following the game, for one autotracking session:
// each reading's news laid on the run as the game's (no undo step), towards
// progress only, as ALttPR's board follows its game (games/alttpr/autotrack/
// follow.ts). Nothing is laid while no game is in play.
//
// - An item takes the game's count when that count changes, or more if the
//   player marked more: the game never takes back a find.
// - The seed's objectives are the ROM's: its table says which the seed asks
//   for. An objective the game says done is done; one it does not say done
//   stays as the player left it.
// - The items the seed adds (the Wall Jump Boots, the split Speed Booster)
//   follow its settings.

import type { SmItemId } from "@alltp/pack-sm";
import type { SmReading } from "@/games/sm/autotrack/reading";
import { type SmProgress, useSmStore } from "@/games/sm/store";

/** What the game says, kept to tell news from what it said before. */
type View = {
  items: Readonly<Record<string, number>>;
  objectives: string;
  done: readonly string[];
  wallJump: boolean | null;
  splitSpeed: boolean | null;
};

const viewOf = (reading: SmReading): View => ({
  done:
    typeof reading.objectives === "string"
      ? []
      : reading.objectives
          .filter(({ done }) => done)
          .map(({ objective }) => objective.id),
  items: typeof reading.items === "string" ? {} : reading.items,
  objectives:
    typeof reading.objectives === "string"
      ? ""
      : reading.objectives.map(({ objective }) => objective.id).join(","),
  splitSpeed: typeof reading.seed === "string" ? null : reading.seed.splitSpeed,
  wallJump: typeof reading.seed === "string" ? null : reading.seed.wallJump,
});

/** Start following the game, for a new session. */
export const createSmFollower = () => {
  let shown: View | null = null;
  return {
    /** Lay a reading's news on the run. */
    read: (reading: SmReading) => {
      if (reading.inPlay !== true) return;
      const now = viewOf(reading);
      const before = shown;
      shown = now;
      const itemNews = Object.entries(now.items).filter(
        ([id, count]) => before === null || before.items[id] !== count,
      );
      const objectivesNews =
        now.objectives !== "" &&
        (before === null || before.objectives !== now.objectives);
      const doneNews = now.done.filter(
        (id) => before === null || !before.done.includes(id),
      );
      const options = (["wallJump", "splitSpeed"] as const).filter(
        (option) =>
          now[option] !== null &&
          (before === null || before[option] !== now[option]),
      );
      if (
        itemNews.length === 0 &&
        !objectivesNews &&
        doneNews.length === 0 &&
        options.length === 0
      ) {
        return;
      }
      useSmStore.getState().applyGameNews((run) => {
        const change: Partial<SmProgress> = {};
        if (itemNews.length > 0) {
          const items = { ...run.items };
          for (const [id, count] of itemNews) {
            items[id as SmItemId] = Math.max(items[id as SmItemId] ?? 0, count);
          }
          change.items = items;
        }
        const objectives = objectivesNews
          ? now.objectives.split(",")
          : run.objectives;
        if (objectivesNews) change.objectives = objectives;
        if (objectivesNews || doneNews.length > 0) {
          change.done = [...new Set([...run.done, ...doneNews])].filter((id) =>
            objectives.includes(id),
          );
        }
        for (const option of options) {
          change[option] = now[option] === true;
        }
        return change;
      });
    },
  };
};
