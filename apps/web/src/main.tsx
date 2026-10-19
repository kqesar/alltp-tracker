import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/index.css";
import { activeGame, loadGame } from "@/games/registry";
import { checkForUpdates, registerServiceWorker } from "@/stores/updateStore";
import { isObsView, obsBackground, obsTimer } from "@/utils/view";

// The desktop app serves its own files and updates itself (desktop/start.ts):
// tested inline, so the site's build drops that import. The site, in
// production builds only: the dev server has no worker (sw/plugin.ts). After
// the page has loaded, so caching the build never competes with the page's
// own downloads.
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

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

// The game this device tracks, its chunk alone: the tracker, or the stream
// view of it
loadGame(activeGame()).then(
  (game) => {
    game.start();
    createRoot(rootElement).render(
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
    rootElement.textContent =
      "The tracker could not load. Check your connection, then reload the page.";
  },
);
