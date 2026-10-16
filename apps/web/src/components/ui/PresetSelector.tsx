import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { describeSettings, getPreset, presets } from "@/data/presets";
import { useGameStore } from "@/stores/gameStore";

/**
 * PresetSelector - lets the player pick a run-type preset (Open, Keysanity,
 * Inverted, ...). Picking a different preset asks for confirmation because it
 * resets the board, then applies the preset's settings.
 */
export const PresetSelector = () => {
  const presetId = useGameStore((state) => state.presetId);
  const settings = useGameStore((state) => state.settings);
  const applyPreset = useGameStore((state) => state.applyPreset);

  const [isListOpen, setIsListOpen] = useState(false);
  const [pendingPresetId, setPendingPresetId] = useState<string | null>(null);

  const current = getPreset(presetId);

  const handlePick = (id: string) => {
    if (id === presetId) {
      setIsListOpen(false);
      return;
    }
    setPendingPresetId(id);
  };

  const confirmSwitch = () => {
    if (pendingPresetId) applyPreset(pendingPresetId);
    setPendingPresetId(null);
    setIsListOpen(false);
  };

  const pending = pendingPresetId ? getPreset(pendingPresetId) : null;

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
        <dl aria-label="Current run settings" className="run-settings">
          {describeSettings(settings).map((row) => (
            <div className="run-settings__row" key={row.label}>
              <dt className="run-settings__label">{row.label}</dt>
              <dd className="run-settings__value">{row.value}</dd>
            </div>
          ))}
        </dl>
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
                  {!preset.logicSupported && (
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
        onCancel={() => setPendingPresetId(null)}
        onConfirm={confirmSwitch}
        title="Switch run type?"
        tone="danger"
      />
    </>
  );
};
