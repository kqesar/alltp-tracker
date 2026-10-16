import { useId, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { StreamIcon } from "@/components/ui/ToolbarIcons";
import { ToolbarMenuItem } from "@/components/ui/ToolbarMenu";
import { ITEMS_PER_ROW } from "@/constants";
import { defaultItemGrid } from "@/data/items";
import { useGameStore } from "@/stores/gameStore";
import { visibleRows } from "@/utils";
import { commandKey } from "@/utils/platform";
import { obsViewUrl, trackerUrl } from "@/utils/view";

/** The icons' own size: a source of 64 px cells draws every pixel whole. */
const NATIVE_CELL = 64;

/**
 * The toolbar's Stream button and its dialog: the address of the stream view
 * (`?view=obs`) to paste into an OBS browser source, and how to set it up.
 * @param variant - A toolbar button, or an item of the toolbar's More menu
 */
export const StreamViewControl = ({
  variant = "toolbar",
}: {
  variant?: "toolbar" | "menu";
}) => {
  const bigKeysVisible = useGameStore((state) => state.bigKeysVisible);
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState("");
  const urlRef = useRef<HTMLInputElement>(null);
  const urlId = useId();

  const url = obsViewUrl();
  const width = (ITEMS_PER_ROW + 1) * NATIVE_CELL;
  const height =
    visibleRows(defaultItemGrid, bigKeysVisible).length * NATIVE_CELL;
  // A size never wraps between its two numbers
  const size = (scale: number) => `${width * scale} × ${height * scale}`;

  const close = () => {
    setIsOpen(false);
    setStatus("");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Copied.");
    } catch {
      // No clipboard access (an insecure page, a denied permission): select
      // the address, so that the older copy command or Ctrl/Cmd+C takes it.
      urlRef.current?.select();
      setStatus(
        document.execCommand?.("copy")
          ? "Copied."
          : `Press ${commandKey()}+C to copy.`,
      );
    }
  };

  return (
    <>
      {variant === "menu" ? (
        <ToolbarMenuItem
          icon={<StreamIcon />}
          label="Stream view"
          onSelect={() => setIsOpen(true)}
          testId="toolbar-more-stream-view"
        />
      ) : (
        <button
          className="tracker-controls__button"
          data-testid="stream-view-button"
          onClick={() => setIsOpen(true)}
          title="Show the item grid on stream (OBS)"
          type="button"
        >
          <StreamIcon />
          <span className="toolbar-label">Stream view</span>
        </button>
      )}

      <Modal
        footer={
          <>
            <a
              className="modal-btn modal-btn--ghost"
              data-testid="stream-view-open"
              href={url}
              rel="noopener noreferrer"
              target="_blank"
            >
              Open in a new tab
            </a>
            <button
              className="modal-btn modal-btn--primary"
              onClick={close}
              type="button"
            >
              Done
            </button>
          </>
        }
        isOpen={isOpen}
        onClose={close}
        title="Stream view"
      >
        <div className="stream-view">
          <p className="modal__message">
            The item grid alone, on a transparent background, sized to its
            source and updated live as you track.
          </p>
          <div>
            <div className="stream-view__label-row">
              <label className="stream-view__label" htmlFor={urlId}>
                Browser source URL
              </label>
              <output
                className="stream-view__status"
                data-testid="stream-view-status"
              >
                {status}
              </output>
            </div>
            <div className="stream-view__field">
              <input
                className="stream-view__url"
                data-testid="stream-view-url"
                id={urlId}
                onFocus={(event) => event.currentTarget.select()}
                readOnly
                ref={urlRef}
                type="text"
                value={url}
              />
              <button
                className="modal-btn modal-btn--primary"
                data-autofocus
                data-testid="stream-view-copy"
                onClick={copy}
                type="button"
              >
                Copy
              </button>
            </div>
          </div>
          <ol className="stream-view__steps">
            <li>
              In OBS, add this tracker, <code>{trackerUrl()}</code>, under Docks
              → Custom Browser Docks, and track your run there.
            </li>
            <li>
              Add a Browser Source with the URL above, {size(1)} for the
              crispest pixels, or {size(2)}. Set its size in the source's
              properties: dragging its handles blurs the pixels.
            </li>
            <li>
              The dock and the source share OBS's browser storage, so the source
              should follow every click: check it on your first run.
            </li>
          </ol>
          <p className="stream-view__note">
            Capturing a browser window instead? It has no transparency: add{" "}
            <code>&amp;bg=00ff00</code> to the URL for a solid colour to key
            out.
          </p>
        </div>
      </Modal>
    </>
  );
};
