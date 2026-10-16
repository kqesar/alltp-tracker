import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/index.css";
import { syncAcrossTabs } from "@/stores/crossTabSync";
import App from "./App.tsx";

syncAcrossTabs();

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} else {
  throw new Error("Root element not found");
}
