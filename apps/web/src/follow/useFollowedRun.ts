import { useEffect, useState } from "react";
import {
  applySnapshot,
  type FollowOptions,
  type FollowStatus,
  follow,
  type Snapshot,
} from "@/follow/client";
import {
  type GameId,
  type GameModule,
  loadGame,
  saveActiveGame,
  switchGame,
} from "@/games/registry";
import { setClockOffset } from "@/utils/clock";
import { followProtocol, followSocketUrl } from "@/utils/view";

/** The game whose grid shows, once its module has loaded. */
export type Shown = { id: GameId; game: GameModule };

/**
 * The run the desktop app relays, followed from the address's token: by the
 * followed view (`?view=follow`, a phone) and by the stream view the app
 * serves to OBS (`?view=obs&token=…`). The run comes from the app's relay;
 * this page never changes it.
 *
 * Nothing is shown before the first run arrives: its game is the one shown,
 * saved as this device's as a `?game=` link does. A run of another game later
 * (the player switched) loads the page again on that game. The last run stays
 * in `shown` through every drop.
 * @param options - `open`, the relay's socket (the tests' fake); `reload`,
 * loads the page again (the tests' seam); `endOnStop` and `maxDelay`, as
 * `follow` takes them
 * @returns The connection's status and the game to draw
 */
export const useFollowedRun = ({
  endOnStop,
  maxDelay,
  open,
  reload,
}: Pick<FollowOptions, "endOnStop" | "maxDelay" | "open"> & {
  reload?: () => void;
}): { shown: Shown | null; status: FollowStatus } => {
  const [status, setStatus] = useState<FollowStatus>("connecting");
  const [shown, setShown] = useState<Shown | null>(null);

  useEffect(() => {
    let game: GameModule | null = null;
    let id: GameId | null = null;
    let latest: Snapshot | null = null;
    let current = true;

    const show = (snapshot: Snapshot) => {
      if (snapshot.game !== id) {
        switchGame(snapshot.game, reload);
        return;
      }
      if (game) applySnapshot(snapshot.value, game.store);
    };

    const stop = follow({
      endOnStop,
      maxDelay,
      onSnapshot: (snapshot, clockOffset) => {
        setClockOffset(clockOffset);
        latest = snapshot;
        if (id !== null) {
          show(snapshot);
          return;
        }
        const first = snapshot.game;
        id = first;
        saveActiveGame(first);
        void loadGame(first).then(
          (loaded) => {
            if (!current || !latest) return;
            game = loaded;
            show(latest);
            setShown({ game: loaded, id: first });
          },
          (error: unknown) => {
            console.error("The tracker could not load:", error);
          },
        );
      },
      onStatus: setStatus,
      open,
      protocol: followProtocol(),
      url: followSocketUrl(),
    });
    return () => {
      current = false;
      stop();
    };
  }, [endOnStop, maxDelay, open, reload]);

  return { shown, status };
};
