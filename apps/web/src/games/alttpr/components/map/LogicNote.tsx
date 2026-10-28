import {
  crossedLogic,
  GLITCHES_LABELS,
  getPreset,
  logicModelled,
} from "@/games/alttpr/data/presets";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

/**
 * What the map's states rest on, when not the whole world: with shuffled
 * entrances, the doors noted (a check behind a door not noted stays out of
 * logic); under logic the pack does not model yet, a glitched one or a run
 * type's, nothing (every check maybe). Nothing for any other run.
 */
export const LogicNote = () => {
  const modelled = useGameStore((state) => logicModelled(state.settings));
  const crossed = useGameStore((state) => crossedLogic(state.settings));
  const presetId = useGameStore((state) => state.presetId);
  const glitches = useGameStore((state) => state.settings.glitches);
  if (crossed)
    return (
      <p className="logic-note" data-testid="logic-note">
        The logic follows the entrances you noted: a check behind a door you
        have not noted stays out of logic.
      </p>
    );
  if (modelled) return null;
  if (glitches !== undefined) {
    return (
      <p className="logic-note" data-testid="logic-note">
        The tracker has no logic for {GLITCHES_LABELS[glitches]} seeds yet:
        every check shows as maybe.
      </p>
    );
  }
  return (
    <p className="logic-note" data-testid="logic-note">
      The tracker has no logic for {getPreset(presetId).name} runs yet: every
      check shows as maybe.
    </p>
  );
};
