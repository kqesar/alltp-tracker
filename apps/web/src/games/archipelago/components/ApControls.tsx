import { useEffect, useRef, useState } from "react";
import { StatusDot } from "@/components/autotrack/StatusDot";
import { GamePicker } from "@/components/ui/GamePicker";
import { lazyDialog } from "@/components/ui/lazyDialog";
import { Modal } from "@/components/ui/Modal";
import { StreamTools } from "@/components/ui/StreamTools";
import { StreamUrlDialog } from "@/components/ui/StreamUrlDialog";
import { PlugIcon, StreamIcon } from "@/components/ui/ToolbarIcons";
import { stageOf, streamSize } from "@/games/archipelago/ArchipelagoObsView";
import { useApConnectionStore } from "@/games/archipelago/connection";
import { headlineOf, phaseOf } from "@/games/archipelago/status";
import { useArchipelagoStore } from "@/games/archipelago/store";
import { useSkin } from "@/games/archipelago/worlds/skins";
import { isDesktopApp } from "@/utils/platform";

/** The connect dialog, a chunk of its own with the guide's words. */
const roomDialog = lazyDialog(
  () =>
    import("@/games/archipelago/components/ConnectDialog").then(
      (module) => module.ConnectDialog,
    ),
  {
    message:
      "The room's settings could not be loaded. Reload the page to try again.",
    title: "Archipelago room",
  },
);

/** The run type dialog: the game, as every game's has it. */
const ModeDialog = ({ onClose }: { onClose: () => void }) => (
  <Modal isOpen onClose={onClose} title="Choose a run type">
    <GamePicker current="archipelago" />
    <p className="ap-mode__note">
      An Archipelago room sets its own run: the board shows what its server
      says, for any game.
    </p>
  </Modal>
);

/**
 * The Archipelago toolbar: Mode (the game), Room (the connection, its dot
 * and words), and the stream view. No New game, undo, export, import or
 * share: the board is the server's, and the room is how to see it again.
 */
export const ApControls = () => {
  const status = useApConnectionStore((state) => state.status);
  const { open, shown } = roomDialog.useDialog();
  const [dialog, setDialog] = useState<"mode" | "stream" | null>(null);
  const phase = phaseOf(status);
  const headline = headlineOf(status);
  // What sizes the stream view's source: the skin's grid, or the list's lines
  const skin = useSkin(useArchipelagoStore((state) => state.room?.game));
  const columns = useArchipelagoStore(
    (state) => stageOf(skin, state.items).columns,
  );
  const rows = useArchipelagoStore((state) => stageOf(skin, state.items).rows);

  // No room yet: the dialog opens on its own, once, as the board does
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    const { address } = useApConnectionStore.getState();
    if (address === "" && useArchipelagoStore.getState().room === null) open();
  }, [open]);

  return (
    <div className="tracker-controls">
      <button
        className="preset-selector__trigger"
        onClick={() => setDialog("mode")}
        title="Choose a run type"
        type="button"
      >
        <span className="preset-selector__label">Mode</span>
        <span className="preset-selector__value">Archipelago</span>
      </button>
      <button
        {...roomDialog.handlers}
        aria-label={`Room, ${headline}`}
        className="tracker-controls__button autotrack-button"
        data-phase={phase}
        data-testid="ap-room-button"
        onClick={open}
        title={`Room: ${headline}`}
        type="button"
      >
        <span className="autotrack-icon">
          <PlugIcon />
          <StatusDot phase={phase} />
        </span>
        <span className="toolbar-label">Room</span>
      </button>
      <span className="toolbar-actions">
        <button
          className="tracker-controls__button"
          data-testid="archipelago-stream-view"
          onClick={() => setDialog("stream")}
          title="The stream view, for OBS"
          type="button"
        >
          <StreamIcon />
          <span className="toolbar-label">Stream view</span>
        </button>
      </span>
      {shown}
      {dialog === "mode" && <ModeDialog onClose={() => setDialog(null)} />}
      {dialog === "stream" &&
        (isDesktopApp ? (
          <StreamTools
            feedOption
            onClose={() => setDialog(null)}
            sizeOf={streamSize({ columns, rows })}
          />
        ) : (
          <StreamUrlDialog
            feedOption
            onClose={() => setDialog(null)}
            testIdPrefix="archipelago"
            timerOption
          />
        ))}
    </div>
  );
};
