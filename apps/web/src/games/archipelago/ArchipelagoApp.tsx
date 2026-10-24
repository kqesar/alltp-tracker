import { useEffect } from "react";
import { GameShell } from "@/components/ui/GameShell";
import { CloseIcon } from "@/components/ui/ToolbarIcons";
import { ApControls } from "@/games/archipelago/components/ApControls";
import { AwayNotice } from "@/games/archipelago/components/AwayNotice";
import { FeedPanel } from "@/games/archipelago/components/FeedPanel";
import { ItemsPanel } from "@/games/archipelago/components/ItemsPanel";
import { RoomLine } from "@/games/archipelago/components/RoomLine";
import { SidePanel } from "@/games/archipelago/components/SidePanel";
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
 * The Archipelago board: the room at a glance (its run timer too), the items
 * the slot received with the room's feed under them, and beside them its
 * checks, hints and players, as the room's server states them; what the slot
 * received while away, once it connects again. It connects as it opens
 * once the player has connected before, and stops with it; a tab that
 * follows another reads the names from the cache that tab filled.
 */
const ArchipelagoApp = () => {
  const game = useArchipelagoStore((state) => state.room?.game);
  const checksum = useArchipelagoStore((state) => state.room?.checksum);

  useEffect(() => {
    // A join link waits for the player: the room it names may not be the saved one
    const { connectOnStart, prefill } = useApConnectionStore.getState();
    if (connectOnStart && prefill === null) void connect();
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
      notices={
        <>
          <RunNotice />
          <AwayNotice />
        </>
      }
      toolbar={<ApControls />}
    >
      <div className="ap-layout" data-testid="layout">
        <RoomLine />
        <div className="ap-board">
          <div className="ap-board__main">
            <ItemsPanel />
            <FeedPanel />
          </div>
          <SidePanel />
        </div>
      </div>
    </GameShell>
  );
};

export default ArchipelagoApp;
