import { useId, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { copyStatus, copyText } from "@/utils/clipboard";
import { obsViewUrl } from "@/utils/view";

/**
 * The stream view's address, to copy into an OBS browser source: the dialog
 * of the games whose stream view is the grid alone (ALttPR's adds a timer and
 * the sizes, `StreamViewControl`).
 * @param testIdPrefix - The game's, for the address's `data-testid`
 */
export const StreamUrlDialog = ({
  feedOption = false,
  onClose,
  testIdPrefix,
}: {
  /** Offer the room's feed under the grid (`&feed=1`), off until ticked. */
  feedOption?: boolean;
  onClose: () => void;
  testIdPrefix: string;
}) => {
  const [feed, setFeed] = useState(false);
  const feedId = useId();
  const url = obsViewUrl({ feed });
  const urlRef = useRef<HTMLParagraphElement>(null);
  const [status, setStatus] = useState("");
  const copy = async () =>
    setStatus(
      copyStatus(
        await copyText(url, () => {
          if (urlRef.current) {
            window.getSelection()?.selectAllChildren(urlRef.current);
          }
        }),
      ),
    );
  return (
    <Modal isOpen onClose={onClose} title="Stream view">
      <p>
        The item grid alone, on a transparent background, for an OBS browser
        source. It follows this tracker live.
      </p>
      {feedOption && (
        <div className="check-option">
          <input
            checked={feed}
            className="check-option__input"
            data-testid={`${testIdPrefix}-stream-feed`}
            id={feedId}
            onChange={(event) => setFeed(event.target.checked)}
            type="checkbox"
          />
          <label htmlFor={feedId}>
            Show the room's last 5 lines involving you under the grid (never a
            hint)
          </label>
        </div>
      )}
      <p
        className="stream-url"
        data-testid={`${testIdPrefix}-stream-url`}
        ref={urlRef}
      >
        {url}
      </p>
      <button className="tracker-controls__button" onClick={copy} type="button">
        Copy the address
      </button>
      <p aria-live="polite" className="stream-status">
        {status}
      </p>
    </Modal>
  );
};
