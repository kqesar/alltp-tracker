import type { Smz3Settings } from "@alltp/pack-smz3";
import { useId } from "react";
import { GamePicker } from "@/components/ui/GamePicker";
import { Modal } from "@/components/ui/Modal";
import { RunToolbar } from "@/components/ui/RunToolbar";
import { Smz3Autotrack } from "@/games/smz3/components/Smz3Autotrack";
import { gridOf, PRESETS } from "@/games/smz3/data";
import { streamSize } from "@/games/smz3/Smz3ObsView";
import { packLink } from "@/games/smz3/share";
import {
  exportSave,
  IMPORT_ERRORS,
  parseSave,
  type Smz3Pads,
  useSmz3Store,
} from "@/games/smz3/store";

const MEDALLION_NAMES: Readonly<Record<Smz3Pads["mire"], string>> = {
  bombos: "Bombos",
  ether: "Ether",
  quake: "Quake",
  unknown: "Not known yet",
};

/** The preset the settings are, or "custom". */
const presetOf = (settings: Smz3Settings): string =>
  PRESETS.find((preset) =>
    (Object.keys(settings) as (keyof Smz3Settings)[]).every(
      (key) => preset.settings[key] === settings[key],
    ),
  )?.id ?? "custom";

/** A labelled select of a number from 0 to `max`. */
const NumberSelect = ({
  label,
  max,
  onChange,
  testId,
  value,
}: {
  label: string;
  max: number;
  onChange: (value: number) => void;
  testId: string;
  value: number;
}) => {
  const id = useId();
  return (
    <div className="mode-field">
      <label htmlFor={id}>{label}</label>
      <select
        className="run-settings__select"
        data-testid={testId}
        id={id}
        onChange={(event) => onChange(Number(event.target.value))}
        value={value}
      >
        {Array.from({ length: max + 1 }, (_, n) => n).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </div>
  );
};

/**
 * The run's settings: the game, a preset races use or the run's own, Super
 * Metroid's logic, keysanity, the crystals and bosses the goal asks for, and
 * what the player knows each medallion pad wants.
 */
const Smz3ModeDialog = ({ onClose }: { onClose: () => void }) => {
  const settings = useSmz3Store((state) => state.settings);
  const pads = useSmz3Store((state) => state.pads);
  const setSettings = useSmz3Store((state) => state.setSettings);
  const setPad = useSmz3Store((state) => state.setPad);
  const presetId = useId();
  const logicId = useId();
  return (
    <Modal isOpen onClose={onClose} title="Choose a run type">
      <GamePicker current="smz3" />
      <div className="mode-field">
        <label htmlFor={presetId}>Run type</label>
        <select
          className="run-settings__select"
          data-testid="smz3-preset"
          id={presetId}
          onChange={(event) => {
            const preset = PRESETS.find((p) => p.id === event.target.value);
            if (preset) setSettings(preset.settings);
          }}
          value={presetOf(settings)}
        >
          {PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
          <option value="custom">My own settings</option>
        </select>
      </div>
      <fieldset className="mode-options">
        <legend>The run's settings, as samus.link sets them</legend>
        <div className="mode-field">
          <label htmlFor={logicId}>Super Metroid logic</label>
          <select
            className="run-settings__select"
            id={logicId}
            onChange={(event) =>
              setSettings({
                smLogic: event.target.value === "hard" ? "hard" : "normal",
              })
            }
            value={settings.smLogic}
          >
            <option value="normal">Normal</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <label className="mode-check">
          <input
            checked={settings.keysanity}
            onChange={(event) =>
              setSettings({ keysanity: event.target.checked })
            }
            type="checkbox"
          />
          Keysanity (keys and keycards anywhere)
        </label>
        <NumberSelect
          label="Crystals to open Ganon's Tower"
          max={7}
          onChange={(towerCrystals) => setSettings({ towerCrystals })}
          testId="smz3-tower-crystals"
          value={settings.towerCrystals}
        />
        <NumberSelect
          label="Crystals to beat Ganon"
          max={7}
          onChange={(ganonCrystals) => setSettings({ ganonCrystals })}
          testId="smz3-ganon-crystals"
          value={settings.ganonCrystals}
        />
        <NumberSelect
          label="Bosses to open Tourian"
          max={4}
          onChange={(tourianBosses) => setSettings({ tourianBosses })}
          testId="smz3-tourian-bosses"
          value={settings.tourianBosses}
        />
      </fieldset>
      <fieldset className="mode-options">
        <legend>What each medallion pad wants</legend>
        {(
          [
            ["mire", "Misery Mire"],
            ["turtleRock", "Turtle Rock"],
          ] as const
        ).map(([pad, name]) => (
          <div className="mode-field" key={pad}>
            <label htmlFor={`${presetId}-${pad}`}>{name}</label>
            <select
              className="run-settings__select"
              id={`${presetId}-${pad}`}
              onChange={(event) =>
                setPad(pad, event.target.value as Smz3Pads["mire"])
              }
              value={pads[pad]}
            >
              {(Object.keys(MEDALLION_NAMES) as Smz3Pads["mire"][]).map(
                (medallion) => (
                  <option key={medallion} value={medallion}>
                    {MEDALLION_NAMES[medallion]}
                  </option>
                ),
              )}
            </select>
          </div>
        ))}
      </fieldset>
    </Modal>
  );
};

/**
 * The SMZ3 toolbar: the run type (with the game), New game, Undo and Redo,
 * Export, Import and Share, and the stream view.
 */
export const Smz3Controls = () => {
  const keysanity = useSmz3Store((state) => state.settings.keysanity);
  return (
    <RunToolbar
      autotrack={<Smz3Autotrack />}
      game="smz3"
      link={packLink}
      ModeDialog={Smz3ModeDialog}
      modeValue="SMZ3"
      resetMessage="Start a new game? What you found, checked and the run timer are cleared; the run's settings stay."
      saveFormat={{ exportSave, IMPORT_ERRORS, parseSave }}
      streamSizeOf={streamSize(gridOf(keysanity).length)}
      useStore={useSmz3Store}
    />
  );
};
