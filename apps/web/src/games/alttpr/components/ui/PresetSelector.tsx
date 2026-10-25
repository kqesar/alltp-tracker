import { useId, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { GamePicker } from "@/components/ui/GamePicker";
import { Modal } from "@/components/ui/Modal";
import { SeedImport } from "@/games/alttpr/components/ui/SeedImport";
import { TricksDialog } from "@/games/alttpr/components/ui/TricksDialog";
import {
  describeSettings,
  getPreset,
  HIDEABLE,
  type HiddenSetting,
  isHidden,
  logicModelled,
  presets,
  type RunSettings,
  TUNING,
  type TunableSetting,
} from "@/games/alttpr/data/presets";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

/** A run type the player picked, waiting for their confirmation. */
type PendingRun = {
  readonly name: string;
  readonly presetId: string;
  /** The seed's hash, for a run started from a seed: the run is its. */
  readonly seed?: string;
  readonly settings: RunSettings;
};

/** The option of a setting not known yet, a Mystery run's. */
const HIDDEN = "?";

/**
 * A tunable setting's select: a change applies at once, the run's progress
 * kept, as one undo step (`updateSettings`). A setting a Mystery run may
 * hide offers "?", not known yet, while it is hidden or in a Mystery run.
 */
const SettingSelect = ({
  id,
  setting,
}: {
  id: string;
  setting: TunableSetting;
}) => {
  const settings = useGameStore((state) => state.settings);
  const presetId = useGameStore((state) => state.presetId);
  const updateSettings = useGameStore((state) => state.updateSettings);
  const hideSetting = useGameStore((state) => state.hideSetting);
  const options: readonly (readonly [boolean | number | string, string])[] =
    TUNING[setting];
  const hidden = isHidden(settings, setting);
  const hideable =
    (HIDEABLE as readonly TunableSetting[]).includes(setting) &&
    (hidden || presetId === "mystery");
  return (
    <select
      className="run-settings__select"
      data-testid={`run-setting-${setting}`}
      id={id}
      onChange={(event) => {
        if (event.target.value === HIDDEN) {
          hideSetting(setting as HiddenSetting);
          return;
        }
        const picked = options.find(
          ([option]) => String(option) === event.target.value,
        );
        if (picked) updateSettings({ [setting]: picked[0] });
      }}
      value={hidden ? HIDDEN : String(settings[setting])}
    >
      {hideable && <option value={HIDDEN}>? Unknown</option>}
      {options.map(([option, words]) => (
        <option key={String(option)} value={String(option)}>
          {words}
        </option>
      ))}
    </select>
  );
};

/**
 * The key cells' switch, a display option of this device and not a seed
 * setting: it sits under the run's summary, apart from the selects. A run
 * whose maps and compasses leave their dungeons shows the cells on its own
 * (`applyRun`); in any other the player shows them to track keys by hand.
 */
const KeyCellsOption = () => {
  const id = useId();
  const bigKeysVisible = useGameStore((state) => state.bigKeysVisible);
  const setBigKeysVisible = useGameStore((state) => state.setBigKeysVisible);
  return (
    <div className="run-display">
      <div className="check-option">
        <input
          aria-describedby={`${id}-hint`}
          checked={bigKeysVisible}
          className="check-option__input"
          data-testid="key-cells-toggle"
          id={id}
          onChange={(event) => setBigKeysVisible(event.target.checked)}
          type="checkbox"
        />
        <label htmlFor={id}>Show key cells</label>
      </div>
      <p className="run-display__hint" id={`${id}-hint`}>
        Shown on their own in MC, MCS and Full; elsewhere, to track keys by
        hand.
      </p>
    </div>
  );
};

/**
 * The Tricks entry, under the key cells' switch: a button that opens the
 * tricks dialog, and a line saying how the tricks stand. A display option of
 * the device, like the switch above it.
 */
const TricksOption = () => {
  const id = useId();
  const [isOpen, setIsOpen] = useState(false);
  const known = useGameStore((state) => state.tricks.techniques.length);
  const enabled = useGameStore((state) => state.tricks.enabled);
  return (
    <div className="run-display">
      <div className="tricks-entry">
        <button
          aria-describedby={`${id}-hint`}
          className="modal-btn modal-btn--ghost"
          data-testid="tricks-button"
          onClick={() => setIsOpen(true)}
          type="button"
        >
          Tricks
        </button>
        <p className="run-display__hint tricks-entry__hint" id={`${id}-hint`}>
          {enabled
            ? `On, ${known === 1 ? "1 trick" : `${known} tricks`} known: checks they open are marked.`
            : "Off. Marks checks a trick opens, out of logic."}
        </p>
      </div>
      <TricksDialog isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
};

/**
 * PresetSelector - lets the player pick a run-type preset (Open, Keysanity,
 * Inverted, ...), or a seed of alttpr.com's, whose settings name one.
 * Picking a different run type asks for confirmation because it resets the
 * board, then applies its settings. The settings that move no dungeon
 * counter (crystals, item placement, pool, functionality, accessibility)
 * change in place from the summary, the run kept.
 */
export const PresetSelector = () => {
  const presetId = useGameStore((state) => state.presetId);
  const settings = useGameStore((state) => state.settings);
  const applyRun = useGameStore((state) => state.applyRun);

  const [isListOpen, setIsListOpen] = useState(false);
  const [pending, setPending] = useState<PendingRun | null>(null);

  const current = getPreset(presetId);
  const idPrefix = useId();

  const handlePick = (id: string) => {
    if (id === presetId) {
      setIsListOpen(false);
      return;
    }
    const preset = getPreset(id);
    setPending({ name: preset.name, presetId: id, settings: preset.settings });
  };

  const confirmSwitch = () => {
    if (pending) {
      const { presetId: id, seed, settings: next } = pending;
      // A run started from a seed is that seed's
      if (seed === undefined) applyRun(id, next);
      else applyRun(id, next, () => ({ seed }));
    }
    setPending(null);
    setIsListOpen(false);
  };

  return (
    <>
      <button
        className="preset-selector__trigger"
        onClick={() => setIsListOpen(true)}
        title="Choose a run type"
        type="button"
      >
        <span className="preset-selector__label">Mode</span>
        <span className="preset-selector__value">{current.name}</span>
      </button>

      <Modal
        isOpen={isListOpen}
        onClose={() => setIsListOpen(false)}
        title="Choose a run type"
      >
        <GamePicker current="alttpr" />
        <dl aria-label="Current run settings" className="run-settings">
          {describeSettings(settings).map((row) => (
            <div className="run-settings__row" key={row.label}>
              <dt className="run-settings__label">
                {row.setting ? (
                  <label htmlFor={`${idPrefix}-${row.setting}`}>
                    {row.label}
                  </label>
                ) : (
                  row.label
                )}
              </dt>
              <dd className="run-settings__value">
                {row.setting ? (
                  <SettingSelect
                    id={`${idPrefix}-${row.setting}`}
                    setting={row.setting}
                  />
                ) : (
                  row.value
                )}
              </dd>
            </div>
          ))}
        </dl>
        <KeyCellsOption />
        <TricksOption />
        <SeedImport
          onSwitch={(seed) =>
            setPending({
              name: seed.seedText,
              presetId: seed.presetId,
              seed: seed.seed,
              settings: seed.settings,
            })
          }
          run={{ presetId, settings }}
        />
        <ul className="preset-list">
          {presets.map((preset) => (
            <li key={preset.id}>
              <button
                aria-current={preset.id === presetId}
                className={`preset-card ${preset.id === presetId ? "preset-card--active" : ""}`}
                onClick={() => handlePick(preset.id)}
                type="button"
              >
                <span className="preset-card__header">
                  <span className="preset-card__name">{preset.name}</span>
                  {!logicModelled(preset.settings) && (
                    <span
                      className="preset-card__badge"
                      title="Selectable now; accessibility logic for this mode is coming soon"
                    >
                      logic soon
                    </span>
                  )}
                </span>
                <span className="preset-card__description">
                  {preset.description}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Modal>

      <ConfirmDialog
        confirmLabel="Switch & reset"
        isOpen={pending !== null}
        message={`Switching to "${pending?.name}" will reset your current progress.`}
        onCancel={() => setPending(null)}
        onConfirm={confirmSwitch}
        title="Switch run type?"
        tone="danger"
      />
    </>
  );
};
