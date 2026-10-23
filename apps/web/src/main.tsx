import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/index.css";
import {
  activeGame,
  loadGame,
  PRODUCT_NAME,
  pageTitle,
  takeGameFromAddress,
} from "@/games/registry";
import {
  checkForUpdates,
  holdGame,
  registerServiceWorker,
} from "@/stores/updateStore";
import { startAnalytics } from "@/utils/analytics";
import { isDesktopApp } from "@/utils/platform";
import { isFollowView, isObsView, obsBackground, obsTimer } from "@/utils/view";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

/**
 * A device following the desktop app's run live (`?view=follow`): only the
 * run it receives, a chunk of its own. Picked before anything else starts:
 * the desktop app serves its own build to that device, whose page would
 * otherwise believe it runs in the app. So no app start-up, no service
 * worker, no update notice, no visit counted.
 */
const startFollowing = (root: HTMLElement) => {
  document.title = `${PRODUCT_NAME} live`;
  import("@/follow/FollowView").then(
    ({ FollowView }) => {
      createRoot(root).render(
        <StrictMode>
          <FollowView />
        </StrictMode>,
      );
    },
    (error: unknown) => {
      console.error("The tracker could not load:", error);
      root.textContent =
        "The tracker could not load. Check your connection, then reload the page.";
    },
  );
};

/** The tracker, or the stream view of it (`?view=obs`). */
const startTracker = (root: HTMLElement) => {
  // The desktop app serves its own files and updates itself
  // (desktop/start.ts): tested inline, so the site's build drops that import.
  // The site, in production builds only: the dev server has no worker
  // (sw/plugin.ts). After the page has loaded, so caching the build never
  // competes with the page's own downloads.
  if (import.meta.env.MODE === "desktop") {
    void import("@/desktop/start").then(({ startDesktop }) => startDesktop());
  } else if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener(
      "load",
      () => {
        const build = document.querySelector<HTMLMetaElement>(
          'meta[name="alltp-tracker-build"]',
        );
        registerServiceWorker(navigator.serviceWorker, {
          build: build?.content ?? "",
          hold: () => holdGame(activeGame(), import.meta.env.BASE_URL),
          reload: () => window.location.reload(),
          url: `${import.meta.env.BASE_URL}sw.js`,
        })
          .then(checkForUpdates)
          .catch((error: unknown) => {
            console.warn("The tracker will not work offline:", error);
          });
      },
      { once: true },
    );
  }

  // The game this device tracks, its chunk alone: the tracker, or the stream
  // view of it
  takeGameFromAddress();
  const active = activeGame();
  if (!isObsView()) document.title = pageTitle(active);

  // Visits are counted on the site alone (utils/analytics.ts): never in the
  // desktop app, nor in the stream view, an OBS source that reloads all day.
  // After the page has loaded, so the count never competes with its downloads.
  if (!isDesktopApp && import.meta.env.PROD && !isObsView()) {
    window.addEventListener("load", () => startAnalytics(), { once: true });
  }

  loadGame(active).then(
    (game) => {
      game.start();
      // The desktop app publishes the run to its servers while the player has
      // one on (desktop/attach.ts)
      if (import.meta.env.MODE === "desktop" && !isObsView()) {
        void import("@/desktop/attach").then(({ attachRun }) =>
          attachRun(active, game.store),
        );
      }
      createRoot(root).render(
        <StrictMode>
          {isObsView() ? (
            <game.ObsView background={obsBackground()} timer={obsTimer()} />
          ) : (
            <game.App />
          )}
        </StrictMode>,
      );
    },
    (error: unknown) => {
      console.error("The tracker could not load:", error);
      root.textContent =
        "The tracker could not load. Check your connection, then reload the page.";
    },
  );
};

if (isFollowView()) startFollowing(rootElement);
else startTracker(rootElement);
