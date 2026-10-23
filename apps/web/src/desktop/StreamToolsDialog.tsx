import { useId, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import type { StreamSize } from "@/components/ui/StreamTools";
import { useStreamStore } from "@/desktop/streamTools";
import { copyStatus, copyText } from "@/utils/clipboard";
import { obsViewUrl } from "@/utils/view";

/** How many browser sources are connected, in words. */
export const sourcesText = (count: number): string => {
  if (count === 0) return "No source is connected yet.";
  return count === 1
    ? "1 source is connected."
    : `${count} sources are connected.`;
};

/**
 * An address to copy: its label, the read-only field that selects itself when
 * focused, and a Copy button whose result is said beside the label. Keyed by
 * its address by the caller, so a changed address forgets "Copied.".
 */
const AddressRow = ({
  label,
  testId,
  url,
}: {
  label: string;
  testId: string;
  url: string;
}) => {
  const [status, setStatus] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const copy = async () =>
    setStatus(
      copyStatus(await copyText(url, () => inputRef.current?.select())),
    );
  return (
    <div>
      <div className="stream-view__label-row">
        <label className="stream-view__label" htmlFor={id}>
          {label}
        </label>
        <output
          className="stream-view__status"
          data-testid={`${testId}-status`}
        >
          {status}
        </output>
      </div>
      <div className="stream-view__field">
        <input
          className="stream-view__url"
          data-testid={`${testId}-url`}
          id={id}
          onFocus={(event) => event.currentTarget.select()}
          readOnly
          ref={inputRef}
          type="text"
          value={url}
        />
        <button
          className="modal-btn modal-btn--primary"
          data-testid={`${testId}-copy`}
          onClick={copy}
          type="button"
        >
          Copy
        </button>
      </div>
    </div>
  );
};

/**
 * The desktop app's stream tools (the toolbar's Stream view button): a switch
 * that makes the app serve the stream view to an OBS browser source on this
 * computer, since OBS can neither load the app's pages nor follow its storage.
 * The address to paste, the run timer under the grid if the player asks, how
 * to size the source, and how many sources are connected.
 *
 * The switch is kept across launches and the stream starts with the app, so a
 * source is set up once. The switch stays focusable while a start or stop
 * runs (`aria-disabled`, not `disabled`, which would drop the focus to the
 * page), and a failure is an alert. The stream is reachable from this
 * computer alone unless the player ticks "Allow other devices on the network",
 * which adds the address those devices use and the firewall hint.
 * @param onClose - Closes the dialog
 * @param sizeOf - The source's size in pixels for the game's grid, with or
 * without the run timer's row; given only by a game that has a run timer
 */
const StreamToolsDialog = ({
  onClose,
  sizeOf,
}: {
  onClose: () => void;
  sizeOf?: (timer: boolean) => StreamSize;
}) => {
  const session = useStreamStore((state) => state.session);
  const pending = useStreamStore((state) => state.pending);
  const error = useStreamStore((state) => state.error);
  const [timer, setTimer] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const timerId = useId();
  const lanId = useId();
  const on = session !== null;

  const urlOn = (base: string) =>
    session ? obsViewUrl({ base, timer, token: session.token }) : "";
  const url = session ? urlOn(session.address) : "";
  const lanUrl = session?.lanAddress ? urlOn(session.lanAddress) : "";
  const sizes = (scale: number) => {
    if (!sizeOf) return "";
    const { height, width } = sizeOf(timer);
    return `${width * scale} × ${height * scale}`;
  };

  const toggle = () => {
    const { pending: busy, start, stop } = useStreamStore.getState();
    if (busy) return;
    void (on ? stop() : start());
  };

  const allowNetwork = (allowed: boolean) => {
    if (useStreamStore.getState().pending) return;
    void useStreamStore.getState().setLan(allowed);
  };

  return (
    <>
      <Modal
        footer={
          <>
            {session && (
              <button
                className="modal-btn modal-btn--ghost"
                data-testid="stream-tools-new"
                onClick={() => setRenewing(true)}
                type="button"
              >
                New addresses
              </button>
            )}
            <button
              className="modal-btn modal-btn--primary"
              onClick={onClose}
              type="button"
            >
              Done
            </button>
          </>
        }
        isOpen
        onClose={onClose}
        title="Stream tools"
        wide
      >
        <div className="stream-view" data-testid="stream-tools">
          <p className="modal__message">
            Show the tracker in OBS while you play here. Rando Atlas serves the
            stream view to a Browser Source on this computer: the item grid
            alone, on a transparent background, updated live as you track. It
            stays on when you restart the app.
          </p>
          <button
            aria-checked={on}
            aria-disabled={pending}
            className="switch"
            data-autofocus
            data-testid="stream-tools-switch"
            onClick={toggle}
            role="switch"
            type="button"
          >
            <span aria-hidden="true" className="switch__track" />
            Serve the stream view to OBS
          </button>
          {/* Mounted at all times: a live region announces what enters it */}
          <p
            className="live-follow__error"
            data-testid="stream-tools-error"
            role="alert"
          >
            {error &&
              `The stream could not ${on ? "change" : "start"}: ${error}`}
          </p>
          {session && (
            <>
              <AddressRow
                key={url}
                label="Browser source URL"
                testId="stream-tools"
                url={url}
              />
              {session.moved && (
                <p
                  className="modal__message"
                  data-testid="stream-tools-moved"
                  role="status"
                >
                  The port the stream used before is taken by another program,
                  so it now uses port {session.port}. Paste the address above
                  into your OBS source again.
                </p>
              )}
              {sizeOf && (
                <div className="check-option">
                  <input
                    checked={timer}
                    className="check-option__input"
                    data-testid="stream-tools-timer"
                    id={timerId}
                    onChange={(event) => setTimer(event.target.checked)}
                    type="checkbox"
                  />
                  <label htmlFor={timerId}>
                    Show the run timer under the grid
                  </label>
                </div>
              )}
              <ol className="stream-view__steps">
                <li>In OBS, add a Browser Source and paste the URL above.</li>
                {sizeOf && (
                  <li>
                    Set its size in the source's properties: {sizes(1)} for the
                    crispest pixels, or {sizes(2)}. Dragging its handles blurs
                    the pixels.
                  </li>
                )}
                <li>
                  Start Rando Atlas before OBS, or tick "Refresh browser when
                  scene becomes active" in the source's properties: OBS does not
                  retry a source whose page failed to load. Once loaded, the
                  source waits for the app and shows the last run until it comes
                  back.
                </li>
              </ol>
              <p
                className="modal__message"
                data-testid="stream-tools-viewers"
                role="status"
              >
                {sourcesText(session.viewers)}
              </p>
              <p className="stream-view__note">
                Capturing a window instead of a Browser Source? Add{" "}
                <code>&amp;bg=00ff00</code> to the URL for a solid colour to key
                out.
              </p>
              <div className="check-option">
                <input
                  checked={session.lan}
                  className="check-option__input"
                  data-testid="stream-tools-lan"
                  id={lanId}
                  onChange={(event) => allowNetwork(event.target.checked)}
                  type="checkbox"
                />
                <label htmlFor={lanId}>
                  Allow other devices on the network
                </label>
              </div>
              {session.lan && (
                <>
                  {lanUrl ? (
                    <AddressRow
                      key={lanUrl}
                      label="For another computer or device"
                      testId="stream-tools-lan-address"
                      url={lanUrl}
                    />
                  ) : (
                    <p
                      className="live-follow__error"
                      data-testid="stream-tools-no-lan"
                    >
                      This computer is on no network: only it can open the
                      address.
                    </p>
                  )}
                  <p
                    className="stream-view__note"
                    data-testid="stream-tools-lan-note"
                  >
                    Anyone on your network who has the address can show your
                    tracker: the secret in it keeps others out, so keep it off
                    screen (OBS shows a source's URL in its properties). If
                    another computer cannot connect, let Rando Atlas through
                    your firewall (port {session.port}).
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </Modal>
      <ConfirmDialog
        confirmLabel="New addresses"
        isOpen={renewing}
        message="The current address stops working and the sources using it go dark until you paste the new one. Do it if the address was shown by mistake."
        onCancel={() => setRenewing(false)}
        onConfirm={() => {
          setRenewing(false);
          void useStreamStore.getState().newTokens();
        }}
        title="Make new addresses?"
      />
    </>
  );
};

export default StreamToolsDialog;
