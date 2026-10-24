import { lazy, Suspense } from "react";

// The desktop app's stream tools, its alone: the test is inline so the site's
// build drops the import and its chunk (docs/desktop.md)
const StreamToolsDialog =
  import.meta.env.MODE === "desktop"
    ? lazy(() => import("@/desktop/StreamToolsDialog"))
    : null;

/** A source's size in pixels. */
export type StreamSize = { width: number; height: number };

/**
 * The dialog the Stream view button opens in the desktop app: the switch that
 * serves the stream view to OBS, and its address. The site has none (its
 * stream view is an address to paste, `StreamViewControl`), so this renders
 * nothing there.
 * @param sizeOf - The browser source's size for the game's grid, with or
 * without the run timer's row (and the feed's rows); given by a game that has
 * a run timer
 * @param feedOption - Offer the room's feed under the grid (`&feed=1`):
 * Archipelago's
 */
export const StreamTools = ({
  feedOption = false,
  onClose,
  sizeOf,
}: {
  onClose: () => void;
  sizeOf?: (timer: boolean, feed?: boolean) => StreamSize;
  feedOption?: boolean;
}) =>
  StreamToolsDialog && (
    <Suspense fallback={null}>
      <StreamToolsDialog
        feedOption={feedOption}
        onClose={onClose}
        sizeOf={sizeOf}
      />
    </Suspense>
  );
