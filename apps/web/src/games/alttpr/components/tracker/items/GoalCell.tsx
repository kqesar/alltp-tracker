import {
  crystalGoalAfter,
  GOAL_CELLS,
  type GoalCell as GoalCellId,
  prizesHeld,
} from "@/games/alttpr/data/items";
import { useStepHandlers } from "@/games/alttpr/hooks/useStepHandlers";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { getAssetPath } from "@/games/alttpr/utils";
import { useGridFocusable } from "@/hooks/useGridNavigation";
import { useTooltip } from "@/hooks/useTooltip";
import { mergeHandlers } from "@/utils/mergeHandlers";

type GoalCellProps = {
  row: number;
  col: number;
  item: GoalCellId;
};

/** Each goal cell's short name and what it names, for its words. */
const GOALS: Readonly<Record<GoalCellId, { short: string; name: string }>> = {
  goalganon: { name: "Ganon", short: "Ganon" },
  goaltower: { name: "Ganon's Tower", short: "GT" },
};

/**
 * What a goal asks for in crystals, Ganon's Tower's or Ganon's: its short
 * name over a crystal and the count, "?" while a Mystery run hides it, green
 * (and "reached" in its name) once the crystals held reach it. The count is
 * the run's setting (`crystalsTower`, `crystalsGanon`), which a seed sets
 * outside Race Mode (in a race the ROM is never read for it) and the player
 * sets in Mode or here: a click one more, round from 7 to 0, a right-click
 * or "-" one fewer, as one undo step (`crystalGoalAfter`, `updateSettings`).
 */
export const GoalCell = ({ row, col, item }: GoalCellProps) => {
  const setting = GOAL_CELLS[item];
  const asked = useGameStore((state) =>
    state.settings.hidden?.includes(setting) ? null : state.settings[setting],
  );
  const crystals = useGameStore((state) => prizesHeld(state.items).crystals);
  const updateSettings = useGameStore((state) => state.updateSettings);
  const { name, short } = GOALS[item];
  const reached = asked !== null && crystals >= asked;
  const handlers = mergeHandlers(
    useGridFocusable({ col, row, slot: 0 }),
    useStepHandlers((direction) =>
      updateSettings({ [setting]: crystalGoalAfter(asked, direction) }),
    ),
    useTooltip({
      kind: "text",
      text: "The seed's setting, also in Mode. Green once you hold them.",
      title: `Crystals ${name} asks for`,
    }),
  );
  const words =
    asked === null
      ? `${name}'s crystals not known yet. Click to set them.`
      : `${name} asks for ${asked} ${asked === 1 ? "crystal" : "crystals"}, you hold ${crystals}${reached ? ", reached" : ""}. Click to change.`;

  return (
    <button
      {...handlers}
      aria-label={`${short} ${asked ?? "?"}: ${words}`}
      className={`griditem grid-item-base goal-cell${reached ? " goal-cell--reached" : ""}`}
      data-testid={`goal-${item}`}
      type="button"
    >
      <span aria-hidden="true" className="goal-cell__name">
        {short}
      </span>{" "}
      <span
        aria-hidden="true"
        className="goal-cell__crystal"
        style={{ backgroundImage: `url(${getAssetPath("crystal0.png")})` }}
      />
      <span aria-hidden="true" className="goal-cell__count">
        {asked ?? "?"}
      </span>
    </button>
  );
};
