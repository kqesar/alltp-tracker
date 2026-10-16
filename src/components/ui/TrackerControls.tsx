import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { PresetSelector } from "@/components/ui/PresetSelector";
import { useGameStore } from "@/stores/gameStore";
import { type Progress, parseSave } from "@/stores/persistence";
import type { MapLayout } from "@/utils";

/** How long a status message such as "Save imported" stays on screen. */
const STATUS_DURATION_MS = 4000;

/** Time left for the browser to start a download before its URL is freed. */
const DOWNLOAD_URL_LIFETIME_MS = 1000;

/** The map layouts the player can pick, in the order they are offered. */
const MAP_LAYOUTS: { value: MapLayout; label: string; hint: string }[] = [
  {
    hint: "Side by side while there is room, stacked below",
    label: "Auto",
    value: "auto",
  },
  {
    hint: "Light World left, Dark World right",
    label: "Side",
    value: "side-by-side",
  },
  {
    hint: "Dark World under the Light World",
    label: "Stack",
    value: "stacked",
  },
];

/**
 * TrackerControls - floating controls to reset progress and export/import a
 * save file. Progress is persisted automatically; these give the user manual
 * control over starting fresh and moving a save between devices. An import is
 * read and validated first, then applied only once the player confirms.
 */
export const TrackerControls = () => {
  const reset = useGameStore((state) => state.reset);
  const exportState = useGameStore((state) => state.exportState);
  const loadProgress = useGameStore((state) => state.loadProgress);
  const undo = useGameStore((state) => state.undo);
  const redo = useGameStore((state) => state.redo);
  const canUndo = useGameStore((state) => state.past.length > 0);
  const canRedo = useGameStore((state) => state.future.length > 0);
  const mapLayout = useGameStore((state) => state.mapLayout);
  const setMapLayout = useGameStore((state) => state.setMapLayout);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isResetOpen, setIsResetOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  // A save that was read and validated, waiting for the player to confirm
  const [pendingImport, setPendingImport] = useState<Partial<Progress> | null>(
    null,
  );
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(""), STATUS_DURATION_MS);
    return () => clearTimeout(timer);
  }, [status]);

  const confirmReset = () => {
    reset();
    setIsResetOpen(false);
    setStatus("New game started.");
  };

  const confirmImport = () => {
    if (pendingImport) loadProgress(pendingImport);
    setPendingImport(null);
    setStatus("Save imported.");
  };

  const handleExport = () => {
    const blob = new Blob([exportState()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `alltp-tracker-save-${new Date().toISOString().slice(0, 10)}.json`;
    // Firefox only follows a download link that is in the document
    document.body.append(link);
    link.click();
    link.remove();
    // The download reads the blob after this handler returns
    setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_LIFETIME_MS);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset the input so selecting the same file again re-triggers onChange
    event.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const save = parseSave(String(reader.result));
      if (save.ok) setPendingImport(save.progress);
      else setImportError(save.reason);
    };
    reader.onerror = () => setImportError("This file could not be read.");
    reader.readAsText(file);
  };

  return (
    <div className="tracker-controls">
      <PresetSelector />
      <button
        className="tracker-controls__button"
        onClick={() => setIsResetOpen(true)}
        title="Start a new game (clears progress)"
        type="button"
      >
        New game
      </button>
      <button
        aria-keyshortcuts="Control+Z Meta+Z"
        className="tracker-controls__button"
        data-testid="undo"
        disabled={!canUndo}
        onClick={undo}
        title="Undo the last change (Ctrl+Z)"
        type="button"
      >
        Undo
      </button>
      <button
        aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
        className="tracker-controls__button"
        data-testid="redo"
        disabled={!canRedo}
        onClick={redo}
        title="Redo (Ctrl+Shift+Z)"
        type="button"
      >
        Redo
      </button>
      <button
        className="tracker-controls__button"
        onClick={handleExport}
        title="Export progress to a file"
        type="button"
      >
        Export
      </button>
      <button
        className="tracker-controls__button"
        onClick={handleImportClick}
        title="Import progress from a file"
        type="button"
      >
        Import
      </button>
      <fieldset className="segmented" data-testid="map-layout">
        <legend className="segmented__legend">Map</legend>
        {MAP_LAYOUTS.map((option) => (
          <label
            className="segmented__option"
            key={option.value}
            title={option.hint}
          >
            <input
              checked={mapLayout === option.value}
              className="segmented__input"
              name="map-layout"
              onChange={() => setMapLayout(option.value)}
              type="radio"
              value={option.value}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      <input
        accept="application/json,.json"
        aria-hidden="true"
        className="sr-only"
        data-testid="import-file"
        onChange={handleImportFile}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />
      <output
        className="tracker-controls__status"
        data-testid="controls-status"
      >
        {status}
      </output>

      <ConfirmDialog
        confirmLabel="New game"
        isOpen={isResetOpen}
        message="This will clear all tracked progress and cannot be undone."
        onCancel={() => setIsResetOpen(false)}
        onConfirm={confirmReset}
        title="Start a new game?"
        tone="danger"
      />

      <ConfirmDialog
        confirmLabel="Replace progress"
        isOpen={pendingImport !== null}
        message="Importing this save replaces the progress tracked now."
        onCancel={() => setPendingImport(null)}
        onConfirm={confirmImport}
        title="Import this save?"
        tone="danger"
      />

      <Modal
        footer={
          <button
            className="modal-btn modal-btn--primary"
            onClick={() => setImportError(null)}
            type="button"
          >
            OK
          </button>
        }
        isOpen={importError !== null}
        onClose={() => setImportError(null)}
        title="Import failed"
      >
        <p className="modal__message">{importError}</p>
      </Modal>
    </div>
  );
};
