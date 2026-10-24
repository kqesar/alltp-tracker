import { useEffect } from "react";
import { GameShell } from "@/components/ui/GameShell";
import { CloseIcon } from "@/components/ui/ToolbarIcons";
import { ApControls } from "@/games/archipelago/components/ApControls";
import { ChecksPanel } from "@/games/archipelago/components/ChecksPanel";
import { ItemsPanel } from "@/games/archipelago/components/ItemsPanel";
import { RoomLine } from "@/games/archipelago/components/RoomLine";
import {
  connect,
  stop,
  useApConnectionStore,
} from "@/games/archipelago/connection";
import { loadCachedNames } from "@/games/archipelago/names";
import { useArchipelagoStore } from "@/games/archipelago/store";

/** Said once when the room holds another run than the board did. */
const RunNotice = () => {
  const notice = useApConnectionStore((state) => state.notice);
  return (
    <div className="notice" data-testid="ap-notice" role="status">
      {notice !== null && (
        <div className="notice__card">
          <p className="notice__message">{notice}</p>
          <div className="notice__actions">
            <button
              aria-label="Dismiss"
              className="notice__button"
              onClick={() => useApConnectionStore.setState({ notice: null })}
              type="button"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * The Archipelago board: the room at a glance, the items the slot received
 * and its checks, as the room's server states them. It connects as it opens
 * once the player has connected before, and stops with it; a tab that
 * follows another reads the names from the cache that tab filled.
 */
const ArchipelagoApp = () => {
  const game = useArchipelagoStore((state) => state.room?.game);
  const checksum = useArchipelagoStore((state) => state.room?.checksum);

  useEffect(() => {
    if (useApConnectionStore.getState().connectOnStart) void connect();
    return stop;
  }, []);

  useEffect(() => {
    if (game !== undefined && checksum !== undefined) {
      void loadCachedNames({ checksum, game });
    }
  }, [game, checksum]);

  return (
    <GameShell
      game="archipelago"
      notices={<RunNotice />}
      toolbar={<ApControls />}
    >
      <div className="ap-layout" data-testid="layout">
        <RoomLine />
        <div className="ap-board">
          <ItemsPanel />
          <ChecksPanel />
        </div>
      </div>
    </GameShell>
  );
};

export default ArchipelagoApp;
