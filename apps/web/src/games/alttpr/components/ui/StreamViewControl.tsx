import { useId, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { StreamTools } from "@/components/ui/StreamTools";
import { StreamIcon } from "@/components/ui/ToolbarIcons";
import { ToolbarMenuItem } from "@/components/ui/ToolbarMenu";
import { streamGridFor } from "@/games/alttpr/data/items";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { visibleRows } from "@/games/alttpr/utils";
import { copyStatus, copyText } from "@/utils/clipboard";
import { isDesktopApp } from "@/utils/platform";
import { obsViewUrl, trackerUrl } from "@/utils/view";

/** The icons' own size: a source of 64 px cells draws every pixel whole. */
const NATIVE_CELL = 64;

/**
 * The toolbar's Stream button and its dialog: the address of the stream view
 * (`?view=obs`) to paste into an OBS browser source, with the run timer under
 * the grid if the player asks (`&timer=1`), and how to set it up.
 * @param variant - A toolbar button, or an item of the toolbar's More menu
 */
export const StreamViewControl = ({
  variant = "toolbar",
}: {
  variant?: "toolbar" | "menu";
}) => {
  const bigKeysVisible = useGameStore((state) => state.bigKeysVisible);
  const mode = useGameStore((state) => state.settings.mode);
  const goal = useGameStore((state) => state.settings.goal);
  const hidden = useGameStore((state) => state.settings.hidden);
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [timer, setTimer] = useState(false);
  const urlRef = useRef<HTMLInputElement>(null);
  const urlId = useId();
  const timerId = useId();

  const url = obsViewUrl({ timer });
  // The stream view's band, as an OBS source (wider than tall) draws it
  const band = visibleRows(
    streamGridFor({ goal, hidden, mode }, bigKeysVisible),
    bigKeysVisible,
  );
  const width = Math.max(...band.map((row) => row.length)) * NATIVE_CELL;
  const rows = band.length;
  // The timer takes a row of its own under the grid
  const sizeOf = (withTimer: boolean) => ({
    height: (withTimer ? rows + 1 : rows) * NATIVE_CELL,
    width,
  });
  const { height } = sizeOf(timer);
  // A size never wraps between its two numbers
  const size = (scale: number) => `${width * scale} × ${height * scale}`;

  const close = () => {
    setIsOpen(false);
    setStatus("");
  };

  const copy = async () =>
    setStatus(copyStatus(await copyText(url, () => urlRef.current?.select())));

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

      {isDesktopApp && isOpen && (
        <StreamTools onClose={close} sizeOf={sizeOf} />
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
        isOpen={isOpen && !isDesktopApp}
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
          <div className="check-option">
            <input
              checked={timer}
              className="check-option__input"
              data-testid="stream-view-timer"
              id={timerId}
              onChange={(event) => {
                setTimer(event.target.checked);
                setStatus("");
              }}
              type="checkbox"
            />
            <label htmlFor={timerId}>Show the run timer under the grid</label>
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
