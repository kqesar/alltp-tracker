import { crossedLogic, getPreset, logicModelled } from "@/data/presets";
import { useGameStore } from "@/stores/gameStore";

/**
 * What the map's states rest on, when not the whole world: with shuffled
 * entrances, the doors noted (a check behind a door not noted stays out of
 * logic); under logic the pack does not model yet, nothing (every check
 * maybe). Nothing for any other run.
 */
export const LogicNote = () => {
  const modelled = useGameStore((state) => logicModelled(state.settings));
  const crossed = useGameStore((state) => crossedLogic(state.settings));
  const presetId = useGameStore((state) => state.presetId);
  if (crossed)
    return (
      <p className="logic-note" data-testid="logic-note">
        The logic follows the entrances you noted: a check behind a door you
        have not noted stays out of logic.
      </p>
    );
  if (modelled) return null;
  return (
    <p className="logic-note" data-testid="logic-note">
      The tracker has no logic for {getPreset(presetId).name} runs yet: every
      check shows as maybe.
    </p>
  );
};
