import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { SeedImport } from "@/components/ui/SeedImport";
import {
  describeSettings,
  getPreset,
  presets,
  type RunSettings,
} from "@/data/presets";
import { useGameStore } from "@/stores/gameStore";

/** A run type the player picked, waiting for their confirmation. */
type PendingRun = {
  readonly name: string;
  readonly presetId: string;
  readonly settings: RunSettings;
};

/**
 * PresetSelector - lets the player pick a run-type preset (Open, Keysanity,
 * Inverted, ...), or a seed of alttpr.com's, whose settings name one.
 * Picking a different run type asks for confirmation because it resets the
 * board, then applies its settings.
 */
export const PresetSelector = () => {
  const presetId = useGameStore((state) => state.presetId);
  const settings = useGameStore((state) => state.settings);
  const applyRun = useGameStore((state) => state.applyRun);

  const [isListOpen, setIsListOpen] = useState(false);
  const [pending, setPending] = useState<PendingRun | null>(null);

  const current = getPreset(presetId);

  const handlePick = (id: string) => {
    if (id === presetId) {
      setIsListOpen(false);
      return;
    }
    const preset = getPreset(id);
    setPending({ name: preset.name, presetId: id, settings: preset.settings });
  };

  const confirmSwitch = () => {
    if (pending) applyRun(pending.presetId, pending.settings);
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
        <dl aria-label="Current run settings" className="run-settings">
          {describeSettings(settings).map((row) => (
            <div className="run-settings__row" key={row.label}>
              <dt className="run-settings__label">{row.label}</dt>
              <dd className="run-settings__value">{row.value}</dd>
            </div>
          ))}
        </dl>
        <SeedImport
          onSwitch={(seed) =>
            setPending({
              name: seed.seedText,
              presetId: seed.presetId,
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
        onCancel={() => setPending(null)}
        onConfirm={confirmSwitch}
        title="Switch run type?"
        tone="danger"
      />
    </>
  );
};
