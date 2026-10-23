import {
  type ChangeEvent,
  type ComponentType,
  type ReactNode,
  useRef,
  useState,
} from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ShareDialog } from "@/components/ui/ShareDialog";
import { StreamUrlDialog } from "@/components/ui/StreamUrlDialog";
import {
  ExportIcon,
  ImportIcon,
  NewGameIcon,
  ShareIcon,
  StreamIcon,
} from "@/components/ui/ToolbarIcons";
import { UndoRedoButtons } from "@/components/ui/UndoRedoButtons";
import type { History } from "@/games/runHistory";
import type { SaveFormat } from "@/games/saveFormat";
import { useStatusLine } from "@/hooks/useStatusLine";
import { SHARE_HELP, type ShareResult, shareRun } from "@/share/shareRun";
import { isDesktopApp } from "@/utils/platform";
import { saveFile } from "@/utils/saveFile";

/** What the toolbar asks of a game's run store, over the run `P`. */
type RunState<P> = P &
  History<P> & {
    load: (progress: P) => void;
    redo: () => void;
    reset: () => void;
    undo: () => void;
  };

/** A game's store, as a hook and for what a click reads at the time. */
type RunStore<P> = {
  <T>(selector: (state: RunState<P>) => T): T;
  getState: () => RunState<P>;
};

type RunToolbarProps<P extends object> = {
  /** The game's autotracking button */
  autotrack: ReactNode;
  /** The game's id: its test ids, and its export's file name */
  game: string;
  /**
   * What a shared link carries for a save: the save itself unless the game
   * packs it as its own link format
   */
  link?: (save: string) => string;
  /** The game's run type dialog, opened by the Mode button */
  ModeDialog: ComponentType<{ onClose: () => void }>;
  /** The game's name, on the Mode button */
  modeValue: string;
  /** What New game asks before it clears the run */
  resetMessage: string;
  saveFormat: SaveFormat<P>;
  useStore: RunStore<P>;
};

/**
 * The toolbar of the games with no More menu (Super Metroid, SMZ3): Mode, New
 * game, Undo and Redo, the game's autotracking, Export, Import, Share and the
 * stream view. The secondary actions sit in a `toolbar-actions` span so they
 * lose their labels first (ui.css). An import is read and validated first,
 * then applied only once the player confirms.
 */
export const RunToolbar = <P extends object>({
  autotrack,
  game,
  link = (save) => save,
  ModeDialog,
  modeValue,
  resetMessage,
  saveFormat: { exportSave, IMPORT_ERRORS, parseSave },
  useStore,
}: RunToolbarProps<P>) => {
  const canUndo = useStore((state) => state.past.length > 0);
  const canRedo = useStore((state) => state.future.length > 0);
  const undo = useStore((state) => state.undo);
  const redo = useStore((state) => state.redo);
  const reset = useStore((state) => state.reset);
  const load = useStore((state) => state.load);
  const [dialog, setDialog] = useState<"mode" | "reset" | "stream" | null>(
    null,
  );
  const [pendingImport, setPendingImport] = useState<P | null>(null);
  const [status, setStatus] = useStatusLine();
  const [share, setShare] = useState<Promise<ShareResult> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = () =>
    saveFile(
      `alltp-tracker-${game}-${new Date().toISOString().slice(0, 10)}.json`,
      exportSave(useStore.getState()),
    );

  const handleShare = () =>
    setShare(shareRun([link(exportSave(useStore.getState()))]));

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
        <span className="preset-selector__value">{modeValue}</span>
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
      <UndoRedoButtons
        canRedo={canRedo}
        canUndo={canUndo}
        onRedo={redo}
        onUndo={undo}
      />
      {autotrack}
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
            data-testid={`${game}-stream-view`}
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
        data-testid={`${game}-status`}
      >
        {status}
      </p>
      {dialog === "mode" && <ModeDialog onClose={() => setDialog(null)} />}
      {dialog === "stream" && (
        <StreamUrlDialog onClose={() => setDialog(null)} testIdPrefix={game} />
      )}
      <ShareDialog onClose={() => setShare(null)} share={share} />
      <ConfirmDialog
        confirmLabel="New game"
        isOpen={dialog === "reset"}
        message={resetMessage}
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
