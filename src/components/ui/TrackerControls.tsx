import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { PresetSelector } from "@/components/ui/PresetSelector";
import { useGameStore } from "@/stores/gameStore";
import { type Progress, parseSave } from "@/stores/persistence";

/** How long a status message such as "Save imported" stays on screen. */
const STATUS_DURATION_MS = 4000;

/** Time left for the browser to start a download before its URL is freed. */
const DOWNLOAD_URL_LIFETIME_MS = 1000;

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
  const mapLayout = useGameStore((state) => state.mapLayout);
  const setMapLayout = useGameStore((state) => state.setMapLayout);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isStacked = mapLayout === "stacked";

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
      <button
        aria-pressed={isStacked}
        className="tracker-controls__button"
        onClick={() => setMapLayout(isStacked ? "side-by-side" : "stacked")}
        title={
          isStacked
            ? "Show the two worlds side by side"
            : "Stack the Dark World under the Light World"
        }
        type="button"
      >
        {isStacked ? "Side-by-side map" : "Stacked map"}
      </button>
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
