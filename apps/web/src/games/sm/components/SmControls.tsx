import { OBJECTIVES } from "@alltp/pack-sm";
import { useId } from "react";
import { GamePicker } from "@/components/ui/GamePicker";
import { Modal } from "@/components/ui/Modal";
import { RunToolbar } from "@/components/ui/RunToolbar";
import { SmAutotrack } from "@/games/sm/components/SmAutotrack";
import {
  OBJECTIVE_PRESET_NAMES,
  OBJECTIVE_PRESETS,
  type ObjectivePreset,
  smGrid,
} from "@/games/sm/data";
import { streamSize } from "@/games/sm/SmObsView";
import {
  exportSave,
  IMPORT_ERRORS,
  parseSave,
  useSmStore,
} from "@/games/sm/store";

/** The preset a list of objectives is, or "custom". */
const presetOf = (objectives: readonly string[]): ObjectivePreset | "custom" =>
  OBJECTIVE_PRESET_NAMES.find(
    ([preset]) =>
      OBJECTIVE_PRESETS[preset].length === objectives.length &&
      OBJECTIVE_PRESETS[preset].every((id) => objectives.includes(id)),
  )?.[0] ?? "custom";

/**
 * The run's settings: the game, the seed's objectives (a preset of Map
 * Rando's, or the ones a Random seed drew, picked one by one) and the two
 * settings that change the grid.
 */
const SmModeDialog = ({ onClose }: { onClose: () => void }) => {
  const objectives = useSmStore((state) => state.objectives);
  const wallJump = useSmStore((state) => state.wallJump);
  const splitSpeed = useSmStore((state) => state.splitSpeed);
  const setObjectives = useSmStore((state) => state.setObjectives);
  const setOption = useSmStore((state) => state.setOption);
  const presetId = useId();
  const preset = presetOf(objectives);
  return (
    <Modal isOpen onClose={onClose} title="Choose a run type">
      <GamePicker current="sm" />
      <div className="mode-field">
        <label htmlFor={presetId}>Objectives</label>
        <select
          className="run-settings__select"
          id={presetId}
          onChange={(event) => {
            const value = event.target.value as ObjectivePreset | "custom";
            if (value !== "custom") setObjectives(OBJECTIVE_PRESETS[value]);
          }}
          value={preset}
        >
          {OBJECTIVE_PRESET_NAMES.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
          <option value="custom">Random, or my own</option>
        </select>
      </div>
      <fieldset className="mode-options">
        <legend>The seed's objectives, as its pause screen lists them</legend>
        {OBJECTIVES.map((objective) => (
          <label className="mode-check" key={objective.id}>
            <input
              checked={objectives.includes(objective.id)}
              onChange={(event) =>
                setObjectives(
                  event.target.checked
                    ? [...objectives, objective.id]
                    : objectives.filter((id) => id !== objective.id),
                )
              }
              type="checkbox"
            />
            {objective.name}
          </label>
        ))}
      </fieldset>
      <fieldset className="mode-options">
        <legend>Items the seed adds</legend>
        <label className="mode-check">
          <input
            checked={wallJump}
            onChange={(event) => setOption("wallJump", event.target.checked)}
            type="checkbox"
          />
          Wall Jump Boots (wall jumps need them)
        </label>
        <label className="mode-check">
          <input
            checked={splitSpeed}
            onChange={(event) => setOption("splitSpeed", event.target.checked)}
            type="checkbox"
          />
          Split Speed Booster (the Spark and Blue Boosters)
        </label>
      </fieldset>
    </Modal>
  );
};

/**
 * The Super Metroid toolbar: the run type (with the game), New game, Undo
 * and Redo, Export, Import and Share, and the stream view.
 */
export const SmControls = () => {
  const wallJump = useSmStore((state) => state.wallJump);
  const splitSpeed = useSmStore((state) => state.splitSpeed);
  return (
    <RunToolbar
      autotrack={<SmAutotrack />}
      game="sm"
      ModeDialog={SmModeDialog}
      modeValue="Super Metroid"
      resetMessage="Start a new game? What you found, the objectives done and the run timer are cleared; the seed's objectives and settings stay."
      saveFormat={{ exportSave, IMPORT_ERRORS, parseSave }}
      streamSizeOf={streamSize(smGrid({ splitSpeed, wallJump }).length)}
      useStore={useSmStore}
    />
  );
};
