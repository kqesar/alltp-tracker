import { type ChangeEvent, useRef } from "react";
import { useGameStore } from "@/stores/gameStore";

/**
 * TrackerControls - floating controls to reset progress and export/import a
 * save file. Progress is persisted automatically; these give the user manual
 * control over starting fresh and moving a save between devices.
 */
export const TrackerControls = () => {
  const reset = useGameStore((state) => state.reset);
  const exportState = useGameStore((state) => state.exportState);
  const importState = useGameStore((state) => state.importState);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleReset = () => {
    if (
      window.confirm(
        "Start a new game? This will clear all tracked progress and cannot be undone.",
      )
    ) {
      reset();
    }
  };

  const handleExport = () => {
    const blob = new Blob([exportState()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "alltp-tracker-save.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset the input so selecting the same file again re-triggers onChange
    event.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (!importState(String(reader.result))) {
        window.alert("Could not import this file: it is not a valid save.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="tracker-controls">
      <button
        className="tracker-controls__button"
        onClick={handleReset}
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
      <input
        accept="application/json,.json"
        aria-hidden="true"
        className="sr-only"
        onChange={handleImportFile}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />
    </div>
  );
};
