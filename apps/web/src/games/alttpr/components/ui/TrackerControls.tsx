import { type ChangeEvent, lazy, Suspense, useRef, useState } from "react";
import { isRaceModeOrPending } from "@/autotrack/raceMode";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { ShareDialog } from "@/components/ui/ShareDialog";
import { ToolbarAction } from "@/components/ui/ToolbarAction";
import {
  ExportIcon,
  ImportIcon,
  NewGameIcon,
  ShareIcon,
} from "@/components/ui/ToolbarIcons";
import {
  ToolbarMenu,
  ToolbarMenuChoice,
  ToolbarMenuGroup,
  ToolbarMenuItem,
  ToolbarMenuSeparator,
} from "@/components/ui/ToolbarMenu";
import { UndoRedoButtons } from "@/components/ui/UndoRedoButtons";
import {
  AutotrackControl,
  AutotrackLiveRegion,
  AutotrackMoreBadge,
} from "@/games/alttpr/components/autotrack/AutotrackControl";
import { PresetSelector } from "@/games/alttpr/components/ui/PresetSelector";
import { ShortcutsButton } from "@/games/alttpr/components/ui/ShortcutsButton";
import { StreamViewControl } from "@/games/alttpr/components/ui/StreamViewControl";
import { packLink } from "@/games/alttpr/share";
import { useAutotrackStore } from "@/games/alttpr/stores/autotrackStore";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import {
  type Progress,
  parseSave,
  withoutTimeline,
} from "@/games/alttpr/stores/persistence";
import type { MapLayout } from "@/games/alttpr/utils";
import { useStatusLine } from "@/hooks/useStatusLine";
import {
  RACE_SHARE_LIVE_HELP,
  RACE_SHARE_NOTE,
  RACE_SHARE_WHY,
} from "@/share/raceShare";
import { SHARE_HELP, type ShareResult, shareRun } from "@/share/shareRun";
import { isDesktopApp } from "@/utils/platform";
import { saveFile } from "@/utils/saveFile";

// The desktop app's "Add to application menu" item, a chunk of its own: the
// test is inline so the site's build drops the import (docs/desktop.md)
const AppMenuItem =
  import.meta.env.MODE === "desktop"
    ? lazy(() => import("@/desktop/AppMenuItem"))
    : null;

/** What the Share dialog opens on in a race: no link, only its note. */
const NO_LINK: Promise<ShareResult> = Promise.resolve({
  link: null,
  message: RACE_SHARE_NOTE,
});

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
  // Race Mode on or not yet known to be off: no file, no link (the desktop
  // app keeps Share open for live follow, which the race whitelist cuts)
  const race = useAutotrackStore(isRaceModeOrPending);
  const shareOff = race && !isDesktopApp;

  const [isResetOpen, setIsResetOpen] = useState(false);
  const [share, setShare] = useState<Promise<ShareResult> | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  // A save that was read and validated, waiting for the player to confirm
  const [pendingImport, setPendingImport] = useState<Partial<Progress> | null>(
    null,
  );
  const [status, setStatus] = useStatusLine();

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
    if (race) return setStatus(RACE_SHARE_WHY);
    saveFile(
      `alltp-tracker-save-${new Date().toISOString().slice(0, 10)}.json`,
      exportState(),
    );
  };

  // The timeline is what a link drops first when it would be too long
  const handleShare = () => {
    if (shareOff) return setStatus(RACE_SHARE_WHY);
    if (race) return setShare(NO_LINK);
    const save = exportState();
    setShare(shareRun([save, withoutTimeline(save)].map(packLink)));
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
        {/* Its words, or its icon where the narrowest bar folds it */}
        <span className="new-game__icon">
          <NewGameIcon />
        </span>
        <span className="new-game__label">New game</span>
      </button>
      <UndoRedoButtons
        canRedo={canRedo}
        canUndo={canUndo}
        onRedo={redo}
        onUndo={undo}
      />
      {/* Its status stays in view: it folds into More last of all */}
      <span className="toolbar-autotrack">
        <AutotrackControl />
      </span>
      <AutotrackLiveRegion />
      {/* The secondary actions: in the toolbar where it has room for them
          all on one row, in the More menu below that (toolbar-menu.css) */}
      <span className="toolbar-secondary">
        <ToolbarAction
          icon={<ExportIcon />}
          label="Export"
          onClick={handleExport}
          title="Export progress to a file"
          unavailable={race ? RACE_SHARE_WHY : null}
        />
        <button
          className="tracker-controls__button"
          onClick={handleImportClick}
          title="Import progress from a file"
          type="button"
        >
          <ImportIcon />
          <span className="toolbar-label">Import</span>
        </button>
        <ToolbarAction
          icon={<ShareIcon />}
          label="Share"
          onClick={handleShare}
          testId="share-button"
          title={race ? RACE_SHARE_LIVE_HELP : SHARE_HELP}
          unavailable={shareOff ? RACE_SHARE_WHY : null}
        />
        <StreamViewControl />
        <ShortcutsButton />
      </span>
      <ToolbarMenu badge={<AutotrackMoreBadge />}>
        {(folded) => {
          // The desktop app shows More at every width, for its own item: the
          // secondary actions repeat the bar's only once it folds them away
          const onBar = isDesktopApp && !folded.has("secondary");
          return (
            <>
              {folded.has("autotrack") && <AutotrackControl variant="menu" />}
              {!onBar && (
                <ToolbarMenuItem
                  icon={<ExportIcon />}
                  label="Export"
                  onSelect={handleExport}
                  testId="toolbar-more-export"
                  unavailable={race ? RACE_SHARE_WHY : null}
                />
              )}
              {!onBar && (
                <ToolbarMenuItem
                  icon={<ImportIcon />}
                  label="Import"
                  onSelect={handleImportClick}
                  testId="toolbar-more-import"
                />
              )}
              {!onBar && (
                <ToolbarMenuItem
                  icon={<ShareIcon />}
                  label="Share"
                  onSelect={handleShare}
                  testId="toolbar-more-share"
                  unavailable={shareOff ? RACE_SHARE_WHY : null}
                />
              )}
              {!onBar && <StreamViewControl variant="menu" />}
              {!onBar && <ShortcutsButton variant="menu" />}
              {AppMenuItem && (
                <Suspense fallback={null}>
                  <AppMenuItem onStatus={setStatus} />
                </Suspense>
              )}
              {/* Settings the narrowest bars fold away, as menu choices */}
              {folded.has("map") && (
                <>
                  <ToolbarMenuSeparator />
                  <ToolbarMenuGroup label="Map">
                    {MAP_LAYOUTS.map((option) => (
                      <ToolbarMenuChoice
                        checked={mapLayout === option.value}
                        key={option.value}
                        kind="radio"
                        label={option.label}
                        onSelect={() => setMapLayout(option.value)}
                        testId={`toolbar-more-map-${option.value}`}
                      />
                    ))}
                  </ToolbarMenuGroup>
                </>
              )}
            </>
          );
        }}
      </ToolbarMenu>
      <fieldset className="segmented toolbar-map" data-testid="map-layout">
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

      <ShareDialog onClose={() => setShare(null)} race={race} share={share} />
      <ConfirmDialog
        confirmLabel="New game"
        isOpen={isResetOpen}
        message="This clears all tracked progress. Undo takes it back."
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
