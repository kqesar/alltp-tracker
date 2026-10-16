import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/index.css";
import { ObsView } from "@/ObsView";
import { syncAcrossTabs } from "@/stores/crossTabSync";
import { isObsView, obsBackground } from "@/utils/view";
import App from "./App.tsx";

syncAcrossTabs();

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
