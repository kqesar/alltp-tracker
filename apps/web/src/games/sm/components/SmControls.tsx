import { OBJECTIVES } from "@alltp/pack-sm";
import { type ChangeEvent, useEffect, useId, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { GamePicker } from "@/components/ui/GamePicker";
import { Modal } from "@/components/ui/Modal";
import {
  ExportIcon,
  ImportIcon,
  NewGameIcon,
  RedoIcon,
  ShareIcon,
  StreamIcon,
  UndoIcon,
} from "@/components/ui/ToolbarIcons";
import { SmAutotrack } from "@/games/sm/components/SmAutotrack";
import {
  OBJECTIVE_PRESET_NAMES,
  OBJECTIVE_PRESETS,
  type ObjectivePreset,
} from "@/games/sm/data";
import {
  exportSave,
  IMPORT_ERRORS,
  parseSave,
  type SmProgress,
  useSmStore,
} from "@/games/sm/store";
import { SHARE_HELP, shareRun } from "@/share/shareRun";
import { commandKey, isDesktopApp } from "@/utils/platform";
import { saveFile } from "@/utils/saveFile";
import { obsViewUrl } from "@/utils/view";

/** How long a status line stays, as ALttPR's toolbar keeps it. */
const STATUS_MS = 4000;

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
      <div className="sm-mode__field">
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
      <fieldset className="sm-mode__objectives">
        <legend>The seed's objectives, as its pause screen lists them</legend>
        {OBJECTIVES.map((objective) => (
          <label className="sm-mode__check" key={objective.id}>
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
      <fieldset className="sm-mode__options">
        <legend>Items the seed adds</legend>
        <label className="sm-mode__check">
          <input
            checked={wallJump}
            onChange={(event) => setOption("wallJump", event.target.checked)}
            type="checkbox"
          />
          Wall Jump Boots (wall jumps need them)
        </label>
        <label className="sm-mode__check">
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

/** The stream view's address, to copy into an OBS browser source. */
const SmStreamDialog = ({ onClose }: { onClose: () => void }) => {
  const url = obsViewUrl({});
  const [copied, setCopied] = useState(false);
  return (
    <Modal isOpen onClose={onClose} title="Stream view">
      <p>
        The item grid alone, on a transparent background, for an OBS browser
        source. It follows this tracker live.
      </p>
      <p className="sm-stream__url" data-testid="sm-stream-url">
        {url}
      </p>
      <button
        className="tracker-controls__button"
        onClick={() =>
          void navigator.clipboard?.writeText(url).then(() => setCopied(true))
        }
        type="button"
      >
        Copy the address
      </button>
      <p aria-live="polite" className="sm-stream__status">
        {copied ? "Copied." : ""}
      </p>
    </Modal>
  );
};

/**
 * The Super Metroid toolbar: the run type (with the game), New game, Undo
 * and Redo, Export and Import, and the stream view.
 */
export const SmControls = () => {
  const canUndo = useSmStore((state) => state.past.length > 0);
  const canRedo = useSmStore((state) => state.future.length > 0);
  const undo = useSmStore((state) => state.undo);
  const redo = useSmStore((state) => state.redo);
  const reset = useSmStore((state) => state.reset);
  const load = useSmStore((state) => state.load);
  const [dialog, setDialog] = useState<"mode" | "reset" | "stream" | null>(
    null,
  );
  const [pendingImport, setPendingImport] = useState<SmProgress | null>(null);
  const [status, setStatus] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(""), STATUS_MS);
    return () => clearTimeout(timer);
  }, [status]);

  const handleExport = () =>
    saveFile(
      `alltp-tracker-sm-${new Date().toISOString().slice(0, 10)}.json`,
      exportSave(useSmStore.getState()),
    );

  const handleShare = () =>
    void shareRun([exportSave(useSmStore.getState())]).then(setStatus);

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
        <span className="preset-selector__value">Super Metroid</span>
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
      <SmAutotrack />
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
          data-testid="sm-stream-view"
          onClick={() => setDialog("stream")}
          title="The stream view, for OBS"
          type="button"
        >
          <StreamIcon />
          <span className="toolbar-label">Stream view</span>
        </button>
      )}
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
        data-testid="sm-status"
      >
        {status}
      </p>
      {dialog === "mode" && <SmModeDialog onClose={() => setDialog(null)} />}
      {dialog === "stream" && (
        <SmStreamDialog onClose={() => setDialog(null)} />
      )}
      <ConfirmDialog
        confirmLabel="New game"
        isOpen={dialog === "reset"}
        message="Start a new game? What you found and the objectives done are cleared; the seed's objectives and settings stay."
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
