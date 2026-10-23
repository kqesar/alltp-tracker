import type { Smz3Settings } from "@alltp/pack-smz3";
import { type ChangeEvent, useEffect, useId, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { GamePicker } from "@/components/ui/GamePicker";
import { Modal } from "@/components/ui/Modal";
import { ShareDialog } from "@/components/ui/ShareDialog";
import {
  ExportIcon,
  ImportIcon,
  NewGameIcon,
  RedoIcon,
  ShareIcon,
  StreamIcon,
  UndoIcon,
} from "@/components/ui/ToolbarIcons";
import { Smz3Autotrack } from "@/games/smz3/components/Smz3Autotrack";
import { PRESETS } from "@/games/smz3/data";
import { packLink } from "@/games/smz3/share";
import {
  exportSave,
  IMPORT_ERRORS,
  parseSave,
  type Smz3Pads,
  type Smz3Progress,
  useSmz3Store,
} from "@/games/smz3/store";
import { SHARE_HELP, type ShareResult, shareRun } from "@/share/shareRun";
import { copyStatus, copyText } from "@/utils/clipboard";
import { commandKey, isDesktopApp } from "@/utils/platform";
import { saveFile } from "@/utils/saveFile";
import { obsViewUrl } from "@/utils/view";

/** How long a status line stays, as the other boards' toolbars keep it. */
const STATUS_MS = 4000;

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

/** The stream view's address, to copy into an OBS browser source. */
const Smz3StreamDialog = ({ onClose }: { onClose: () => void }) => {
  const url = obsViewUrl({});
  const urlRef = useRef<HTMLParagraphElement>(null);
  const [status, setStatus] = useState("");
  const copy = async () =>
    setStatus(
      copyStatus(
        await copyText(url, () => {
          if (urlRef.current) {
            window.getSelection()?.selectAllChildren(urlRef.current);
          }
        }),
      ),
    );
  return (
    <Modal isOpen onClose={onClose} title="Stream view">
      <p>
        The item grid alone, on a transparent background, for an OBS browser
        source. It follows this tracker live.
      </p>
      <p className="stream-url" data-testid="smz3-stream-url" ref={urlRef}>
        {url}
      </p>
      <button className="tracker-controls__button" onClick={copy} type="button">
        Copy the address
      </button>
      <p aria-live="polite" className="stream-status">
        {status}
      </p>
    </Modal>
  );
};

/**
 * The SMZ3 toolbar: the run type (with the game), New game, Undo and Redo,
 * Export and Import, and the stream view.
 */
export const Smz3Controls = () => {
  const canUndo = useSmz3Store((state) => state.past.length > 0);
  const canRedo = useSmz3Store((state) => state.future.length > 0);
  const undo = useSmz3Store((state) => state.undo);
  const redo = useSmz3Store((state) => state.redo);
  const reset = useSmz3Store((state) => state.reset);
  const load = useSmz3Store((state) => state.load);
  const [dialog, setDialog] = useState<"mode" | "reset" | "stream" | null>(
    null,
  );
  const [pendingImport, setPendingImport] = useState<Smz3Progress | null>(null);
  const [share, setShare] = useState<Promise<ShareResult> | null>(null);
  const [status, setStatus] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(""), STATUS_MS);
    return () => clearTimeout(timer);
  }, [status]);

  const handleExport = () =>
    saveFile(
      `alltp-tracker-smz3-${new Date().toISOString().slice(0, 10)}.json`,
      exportSave(useSmz3Store.getState()),
    );

  const handleShare = () =>
    setShare(shareRun([packLink(exportSave(useSmz3Store.getState()))]));

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = event.target.files ?? [];
    event.target.value = "";
    if (!file) return;
    void file.text().then(
      (text) => {
        const save = parseSave(text);
        if (save.ok) setPendingImport(save.progress);
        else setStatus(IMPORT_ERRORS[save.error]);
      },
      () => setStatus("This file could not be read."),
    );
  };

  return (
    <div className="tracker-controls">
      <button
        className="preset-selector__trigger"
        onClick={() => setDialog("mode")}
        title="Choose a run type"
        type="button"
      >
        <span className="preset-selector__label">Mode</span>
        <span className="preset-selector__value">SMZ3</span>
      </button>
      <button
        className="tracker-controls__button"
        onClick={() => setDialog("reset")}
        title="Start a new game (clears progress)"
        type="button"
      >
        <NewGameIcon />
        <span className="toolbar-label">New game</span>
      </button>
      <button
        aria-keyshortcuts="Control+Z Meta+Z"
        className="tracker-controls__button"
        data-testid="undo"
        disabled={!canUndo}
        onClick={undo}
        title={`Undo the last change (${commandKey()}+Z)`}
        type="button"
      >
        <UndoIcon />
        <span className="sr-only">Undo</span>
      </button>
      <button
        aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
        className="tracker-controls__button"
        data-testid="redo"
        disabled={!canRedo}
        onClick={redo}
        title={`Redo (${commandKey()}+Shift+Z)`}
        type="button"
      >
        <RedoIcon />
        <span className="sr-only">Redo</span>
      </button>
      <Smz3Autotrack />
      {/* The secondary actions lose their labels before the primary controls
          do (ui.css); with no More menu they never move */}
      <span className="toolbar-actions">
        <button
          className="tracker-controls__button"
          onClick={handleExport}
          title="Export progress to a file"
          type="button"
        >
          <ExportIcon />
          <span className="toolbar-label">Export</span>
        </button>
        <button
          className="tracker-controls__button"
          onClick={() => fileRef.current?.click()}
          title="Import progress from a file"
          type="button"
        >
          <ImportIcon />
          <span className="toolbar-label">Import</span>
        </button>
        <button
          className="tracker-controls__button"
          data-testid="share-button"
          onClick={handleShare}
          title={SHARE_HELP}
          type="button"
        >
          <ShareIcon />
          <span className="toolbar-label">Share</span>
        </button>
        {/* OBS cannot load the desktop app's page nor follow its storage */}
        {!isDesktopApp && (
          <button
            className="tracker-controls__button"
            data-testid="smz3-stream-view"
            onClick={() => setDialog("stream")}
            title="The stream view, for OBS"
            type="button"
          >
            <StreamIcon />
            <span className="toolbar-label">Stream view</span>
          </button>
        )}
      </span>
      <input
        accept="application/json,.json"
        aria-label="Import a save file"
        className="sr-only"
        data-testid="import-file"
        onChange={handleImport}
        ref={fileRef}
        tabIndex={-1}
        type="file"
      />
      <p
        aria-live="polite"
        className="tracker-controls__status"
        data-testid="smz3-status"
      >
        {status}
      </p>
      {dialog === "mode" && <Smz3ModeDialog onClose={() => setDialog(null)} />}
      {dialog === "stream" && (
        <Smz3StreamDialog onClose={() => setDialog(null)} />
      )}
      <ShareDialog onClose={() => setShare(null)} share={share} />
      <ConfirmDialog
        confirmLabel="New game"
        isOpen={dialog === "reset"}
        message="Start a new game? What you found and checked is cleared; the run's settings stay."
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          reset();
          setDialog(null);
          setStatus("New game started.");
        }}
        title="New game?"
        tone="danger"
      />
      <ConfirmDialog
        confirmLabel="Import"
        isOpen={pendingImport !== null}
        message="Replace your current run with this save? Undo takes it back."
        onCancel={() => setPendingImport(null)}
        onConfirm={() => {
          if (pendingImport) load(pendingImport);
          setPendingImport(null);
          setStatus("Save imported.");
        }}
        title="Import this save?"
      />
    </div>
  );
};
