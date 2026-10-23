import type { FollowOptions, FollowStatus } from "@/follow/client";
import { useFollowedRun } from "@/follow/useFollowedRun";
import { PRODUCT_NAME } from "@/games/registry";

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
  const { shown, status } = useFollowedRun({ open, reload });
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
          <ObsView background={null} relay="follow" timer />
        </div>
      )}
    </div>
  );
};
