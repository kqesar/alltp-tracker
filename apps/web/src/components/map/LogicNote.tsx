import { getPreset, logicModelled } from "@/data/presets";
import { useGameStore } from "@/stores/gameStore";

/**
 * Why every check is maybe: the run's logic is one the pack does not model
 * yet (the retro world, shuffled entrances). Nothing while it is modelled.
 */
export const LogicNote = () => {
  const modelled = useGameStore((state) => logicModelled(state.settings));
  const presetId = useGameStore((state) => state.presetId);
  if (modelled) return null;
  return (
    <p className="logic-note" data-testid="logic-note">
      The tracker has no logic for {getPreset(presetId).name} runs yet: every
      check shows as maybe.
    </p>
  );
};
