import { useEffect } from "react";
import { lazyDialog } from "@/components/ui/lazyDialog";
import { KeyboardIcon } from "@/components/ui/ToolbarIcons";
import { ToolbarMenuItem } from "@/components/ui/ToolbarMenu";

const dialog = lazyDialog(
  () =>
    import("@/games/alttpr/components/ui/ShortcutsDialog").then(
      (module) => module.ShortcutsDialog,
    ),
  {
    message:
      "The shortcuts settings could not be loaded. Reload the page to try again; your run is saved.",
    title: "Keyboard shortcuts",
  },
);

/**
 * Fetch the shortcuts dialog's code, once: it is a chunk of its own, asked
 * for when the page is idle or as soon as the pointer or focus reaches a
 * control that opens it, so it is there by the click (see `lazyDialog`).
 */
export const preloadShortcutsDialog = dialog.preload;

/** How long to wait for an idle moment before fetching the dialog anyway. */
const IDLE_TIMEOUT_MS = 3000;

/**
 * Fetch the dialog once the page is idle, off the first render's path: a tap
 * on a phone gives no hover to start it early, and on a slow network the
 * chunk would otherwise arrive after the tap.
 */
const usePrefetchWhenIdle = () => {
  useEffect(() => {
    const prefetch = () => void preloadShortcutsDialog().catch(() => {});
    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(prefetch, {
        timeout: IDLE_TIMEOUT_MS,
      });
      return () => window.cancelIdleCallback(handle);
    }
    // Safari has no requestIdleCallback
    const timer = setTimeout(prefetch, IDLE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);
};

/**
 * The toolbar button that opens the keyboard shortcuts dialog. The dialog is
 * mounted only while open, so it costs nothing the rest of the time and
 * starts afresh each time. Its code is a chunk of its own, fetched once the
 * page is idle, or sooner when a pointer or focus reaches the button.
 * @param variant - A toolbar button, or an item of the toolbar's More menu
 */
export const ShortcutsButton = ({
  variant = "toolbar",
}: {
  variant?: "toolbar" | "menu";
}) => {
  const { open, shown } = dialog.useDialog();
  usePrefetchWhenIdle();

  return (
    <>
      {variant === "menu" ? (
        <ToolbarMenuItem
          {...dialog.handlers}
          icon={<KeyboardIcon />}
          label="Shortcuts"
          onSelect={open}
          testId="toolbar-more-shortcuts"
        />
      ) : (
        <button
          {...dialog.handlers}
          className="tracker-controls__button"
          data-testid="shortcuts-button"
          onClick={open}
          title="Keyboard shortcuts"
          type="button"
        >
          <KeyboardIcon />
          <span className="toolbar-label">Shortcuts</span>
        </button>
      )}
      {shown}
    </>
  );
};
