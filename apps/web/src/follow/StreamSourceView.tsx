import { useEffect, useLayoutEffect, useRef } from "react";
import type { FollowOptions } from "@/follow/client";
import { isStaleBuild } from "@/follow/staleBuild";
import { useFollowedRun } from "@/follow/useFollowedRun";
import { obsBackground, obsFeed, obsTimer } from "@/utils/view";

/** A browser source waits for the app this long at most between attempts. */
const MAX_DELAY = 5000;

const reloadPage = () => window.location.reload();

/**
 * What the source says once its address is out of date. The page stays
 * transparent, as the stream view is (`:root[data-view]`, which the grid's
 * own stage sets while it shows).
 */
const OutOfDate = () => {
  useLayoutEffect(() => {
    document.documentElement.dataset.view = "obs";
    return () => {
      delete document.documentElement.dataset.view;
    };
  }, []);
  return (
    <main className="stream-source__notice" data-testid="stream-source-notice">
      <p>
        This address is out of date. Copy the new one from Rando Atlas (Stream
        view) into this source.
      </p>
    </main>
  );
};

/**
 * The stream view the desktop app serves to an OBS browser source
 * (`?view=obs&token=…`, `&timer=1`, `&bg=…` as the site's): the game's own
 * stream view, on a transparent page, drawing the run the app relays. OBS
 * cannot follow the app's storage, so the run arrives by the same stream a
 * phone follows (`useFollowedRun`).
 *
 * Nobody watches this page's connection: it shows no banner and keeps the
 * last grid through every drop. It never gives up on the app stopping or
 * quitting (the player turns the stream off and on, or restarts the app, and
 * the source must come back by itself), retrying every 5 s at most. After a
 * drop it checks that the app still serves the build it runs, and loads the
 * page again if an update replaced it. The one thing it says is that its
 * address is out of date (the player asked for new ones): the grid is then
 * hidden, since it would show a run that no longer moves.
 *
 * The grid sits in an `inert` container: OBS's Interact window changes
 * nothing, the run being the player's.
 * @param open - Opens the relay's socket (the tests' fake)
 * @param reload - Loads the page again (the tests' seam)
 * @param stale - Whether the app serves another build (the tests' seam)
 */
export const StreamSourceView = ({
  open,
  reload = reloadPage,
  stale = isStaleBuild,
}: {
  open?: FollowOptions["open"];
  reload?: () => void;
  stale?: () => Promise<boolean>;
}) => {
  const { shown, status } = useFollowedRun({
    endOnStop: false,
    maxDelay: MAX_DELAY,
    open,
    reload,
  });
  const wasDown = useRef(false);

  useEffect(() => {
    if (status === "reconnecting" || status === "full") {
      wasDown.current = true;
      return;
    }
    if (status !== "live" || !wasDown.current) return;
    wasDown.current = false;
    let current = true;
    void stale().then((replaced) => {
      if (current && replaced) reload();
    });
    return () => {
      current = false;
    };
  }, [reload, stale, status]);

  if (status === "expired") return <OutOfDate />;
  const ObsView = shown?.game.ObsView;
  return (
    ObsView && (
      <div className="stream-source" data-testid="stream-source" inert>
        <ObsView
          background={obsBackground()}
          feed={obsFeed()}
          relay="obs"
          timer={obsTimer()}
        />
      </div>
    )
  );
};
