import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/index.css";
import { ObsView } from "@/ObsView";
import { syncAcrossTabs } from "@/stores/crossTabSync";
import { registerServiceWorker } from "@/stores/updateStore";
import { isObsView, obsBackground } from "@/utils/view";
import App from "./App.tsx";

syncAcrossTabs();

// Production builds only: the dev server has no worker (sw/plugin.ts). After
// the page has loaded, so caching the build never competes with the page's
// own downloads.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener(
    "load",
    () => {
      registerServiceWorker(
        navigator.serviceWorker,
        `${import.meta.env.BASE_URL}sw.js`,
        () => window.location.reload(),
      ).catch((error: unknown) => {
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
      {isObsView() ? <ObsView background={obsBackground()} /> : <App />}
    </StrictMode>,
  );
} else {
  throw new Error("Root element not found");
}
