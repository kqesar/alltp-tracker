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
  PRODUCT_NAME,
  saveActiveGame,
  switchGame,
} from "@/games/registry";
import { setClockOffset } from "@/utils/clock";
import { followSocketUrl } from "@/utils/view";

/** What the banner says of each status: a word, then what it means. */
export const STATUS_WORDS: Readonly<
  Record<FollowStatus, { label: string; detail: string }>
> = {
  connecting: {
    detail: "Connecting to the player's tracker…",
    label: "Connecting",
  },
  expired: {
    detail:
      "This link is no longer valid: the player turned live follow off and on again. Scan the new QR code in their tracker.",
    label: "Link expired",
  },
  full: {
    detail: "Eight devices already follow this run. Trying again…",
    label: "Full",
  },
  live: { detail: "Following the run as it is tracked.", label: "Live" },
  reconnecting: {
    detail:
      "Cannot reach the player's tracker. Trying again… Stay on the same network as their computer.",
    label: "Reconnecting",
  },
  stopped: {
    detail:
      "The player stopped sharing this run. Ask them for a new link to follow again.",
    label: "Stopped",
  },
};

/**
 * The status dot autotracking draws, a shape per phase: filled while live,
 * half while trying, a ring once stopped, a triangle for a dead link.
 */
const DOT_PHASES: Readonly<Record<FollowStatus, string>> = {
  connecting: "busy",
  expired: "problem",
  full: "busy",
  live: "on",
  reconnecting: "busy",
  stopped: "off",
};

/** The game whose grid shows, once its module has loaded. */
type Shown = { id: GameId; game: GameModule };

/**
 * The followed view (`?view=follow&token=…`): what a phone or a second
 * computer on the same network shows while the desktop app shares its run.
 * The run comes from the app's relay; this page never changes it. The grid is
 * the game's stream view, inside an `inert` container and without its
 * keyboard shortcuts, on an opaque page under a banner that says how the
 * connection stands.
 *
 * Nothing renders before the first run arrives: its game is the one shown,
 * saved as this device's as a `?game=` link does. A run of another game later
 * (the player switched) loads the page again on that game.
 * @param open - Opens the relay's socket (the tests' fake)
 * @param reload - Loads the page again (the tests' seam)
 */
export const FollowView = ({
  open,
  reload,
}: {
  open?: FollowOptions["open"];
  reload?: () => void;
}) => {
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
      url: followSocketUrl(),
    });
    return () => {
      current = false;
      stop();
    };
  }, [open, reload]);

  const words = STATUS_WORDS[status];
  const ObsView = shown?.game.ObsView;
  return (
    <div className="follow-view" data-testid="follow-view">
      <header className="follow-banner">
        <h1 className="follow-banner__title">{PRODUCT_NAME}</h1>
        <p
          className="follow-banner__status"
          data-status={status}
          data-testid="follow-status"
          role="status"
        >
          <span
            aria-hidden="true"
            className="autotrack-dot"
            data-phase={DOT_PHASES[status]}
          />
          <strong className="follow-banner__label">{words.label}</strong>
          <span className="follow-banner__detail">{words.detail}</span>
        </p>
      </header>
      {ObsView && (
        <div className="follow-view__board" data-testid="follow-board" inert>
          <ObsView background={null} followed timer />
        </div>
      )}
    </div>
  );
};
