import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/index.css";
import { ObsView } from "@/games/alttpr/ObsView";
import { syncAcrossTabs } from "@/games/alttpr/stores/crossTabSync";
import { checkForUpdates, registerServiceWorker } from "@/stores/updateStore";
import { isObsView, obsBackground, obsTimer } from "@/utils/view";
import App from "./games/alttpr/App.tsx";

syncAcrossTabs();

// Production builds only: the dev server has no worker (sw/plugin.ts). After
// the page has loaded, so caching the build never competes with the page's
// own downloads.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
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
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      {isObsView() ? (
        <ObsView background={obsBackground()} timer={obsTimer()} />
      ) : (
        <App />
      )}
    </StrictMode>,
  );
} else {
  throw new Error("Root element not found");
}
