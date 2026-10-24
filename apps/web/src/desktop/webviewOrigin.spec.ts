import { describe, expect, it } from "vitest";
import tauriConfig from "../../../desktop/src-tauri/tauri.conf.json?raw";

type WindowConfig = { useHttpsScheme?: boolean };

describe("the desktop app's pages", () => {
  // On Windows the pages are http://tauri.localhost unless useHttpsScheme
  // turns them https://: plain ws:// would then be mixed content, and the
  // app would lose what it alone reaches (SNI at ws://localhost, a
  // self-hosted Archipelago room's ws://, docs/desktop.md "Archipelago rooms")
  it("keep WebView2's http scheme", () => {
    const { app } = JSON.parse(tauriConfig) as {
      app: { windows: WindowConfig[] };
    };
    expect(app.windows.length).toBeGreaterThan(0);
    for (const window of app.windows) {
      expect(window.useHttpsScheme ?? false).toBe(false);
    }
  });
});
