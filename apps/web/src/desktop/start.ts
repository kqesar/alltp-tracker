// What the desktop app adds to the tracker's page, once, as it opens: its
// updates, its links and the state of its application menu entry. Imported only in the desktop build (main.tsx, behind
// isDesktopApp), so the site never downloads it.

import { openUrl } from "@tauri-apps/plugin-opener";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import { useAppMenuStore } from "@/desktop/appMenu";
import { UPDATE_CHECK_INTERVAL_MS, useUpdateStore } from "@/stores/updateStore";

/**
 * Look for a newer release on GitHub (tauri.conf.json's updater endpoint,
 * signed with the project's key) and offer it as the site offers its own:
 * the notice waits, and the player restarts when the run allows. A check
 * that fails, offline, waits for the next one.
 *
 * Live follow stops between the download and the install: on Windows the
 * installer ends the app without its exit event, which would leave the
 * devices following retrying forever instead of saying "Stopped". A
 * download that fails leaves it running.
 */
export const offerUpdate = async () => {
  try {
    const update = await check();
    if (update === null) return;
    useUpdateStore.setState({
      apply: () => {
        void (async () => {
          await update.download();
          const { useLiveFollowStore } = await import("@/desktop/liveFollow");
          if (useLiveFollowStore.getState().session) {
            await useLiveFollowStore.getState().stop();
          }
          await update.install();
          await relaunch();
        })().catch((error: unknown) => {
          console.warn("Could not install the new version:", error);
        });
      },
      label: "Restart",
    });
  } catch (error) {
    console.warn("Could not check for a new version:", error);
  }
};

/**
 * A link out of the tracker opens in the system browser: in the app's
 * window it would take the tracker's place.
 */
export const openLinksOutside = (event: MouseEvent) => {
  const link = (event.target as Element | null)?.closest?.("a[href]");
  if (!(link instanceof HTMLAnchorElement)) return;
  if (link.origin === window.location.origin) return;
  event.preventDefault();
  openUrl(link.href).catch((error: unknown) => {
    console.warn("Could not open the link:", error);
  });
};

export const startDesktop = () => {
  document.addEventListener("click", openLinksOutside);
  // Whether an AppImage can add itself to the application menu: the notice
  // and the More menu's item wait for the answer (desktop/appMenu.ts)
  void useAppMenuStore.getState().load();
  // The dev server is no release: nothing to update
  if (import.meta.env.DEV) return;
  void offerUpdate();
  setInterval(() => void offerUpdate(), UPDATE_CHECK_INTERVAL_MS);
};
