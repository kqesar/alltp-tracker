import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import { useLiveFollowStore } from "@/desktop/liveFollow";
import { copyStatus, copyText } from "@/utils/clipboard";

const QrCode = lazy(() => import("@/components/ui/QrCode"));

/** How many devices follow, in words. */
export const viewersText = (count: number): string => {
  if (count === 0) return "No device follows yet.";
  return count === 1 ? "1 device follows." : `${count} devices follow.`;
};

/**
 * The Share dialog's live follow, in the desktop app: a switch that opens
 * the app's relay on the local network, then the live link as a QR code and
 * an address to copy, how many devices follow, and what the other device
 * needs (the same network, a firewall that lets it in). Off by default, and
 * after each launch: no port opens unless the player asks.
 *
 * The switch stays focusable while a start or stop runs (`aria-disabled`,
 * not `disabled`, which would drop the focus to the page), a failure is
 * an alert, and the new link is scrolled into view: the dialog's own QR
 * code, the snapshot's, sits above it.
 */
const LiveFollowSection = () => {
  const session = useLiveFollowStore((state) => state.session);
  const pending = useLiveFollowStore((state) => state.pending);
  const error = useLiveFollowStore((state) => state.error);
  const [copied, setCopied] = useState("");
  const headingId = useId();
  const urlRef = useRef<HTMLParagraphElement>(null);
  const linkRef = useRef<HTMLDivElement>(null);
  // The player just turned it on: show the link once it comes
  const starting = useRef(false);
  const on = session !== null;
  const url = session?.url;

  useEffect(() => {
    if (!url || !starting.current) return;
    starting.current = false;
    linkRef.current?.scrollIntoView({ block: "nearest" });
  }, [url]);

  const toggle = () => {
    const { pending: busy, start, stop } = useLiveFollowStore.getState();
    if (busy) return;
    setCopied("");
    starting.current = !on;
    void (on ? stop() : start());
  };

  const copy = async () => {
    if (!session) return;
    const result = await copyText(session.url, () => {
      if (urlRef.current) {
        window.getSelection()?.selectAllChildren(urlRef.current);
      }
    });
    setCopied(copyStatus(result));
  };

  return (
    <section
      aria-labelledby={headingId}
      className="live-follow"
      data-testid="live-follow"
    >
      <h3 className="live-follow__heading" id={headingId}>
        Follow live on this network
      </h3>
      <button
        aria-checked={on}
        aria-disabled={pending}
        className="switch"
        data-testid="live-follow-switch"
        onClick={toggle}
        role="switch"
        type="button"
      >
        <span aria-hidden="true" className="switch__track" />
        Share the run live
      </button>
      <p className="modal__message share-dialog__help">
        A phone or a computer on the same Wi-Fi opens a link and watches the
        board update as you track. Nothing leaves your network.
      </p>
      {/* Mounted at all times: a live region announces what enters it */}
      <p
        className="live-follow__error"
        data-testid="live-follow-error"
        role="alert"
      >
        {error && `Live follow could not ${on ? "stop" : "start"}: ${error}`}
      </p>
      {session && (
        <>
          <div className="live-follow__link" ref={linkRef}>
            <Suspense fallback={<div className="share-qr" />}>
              <QrCode label="QR code of the live link" text={session.url} />
            </Suspense>
            <p
              className="live-follow__url"
              data-testid="live-follow-url"
              ref={urlRef}
            >
              {session.url}
            </p>
            <div className="live-follow__actions">
              <button
                className="modal-btn modal-btn--ghost"
                data-testid="live-follow-copy"
                onClick={copy}
                type="button"
              >
                Copy the live link
              </button>
              <output aria-live="polite">{copied}</output>
            </div>
          </div>
          <p
            className="modal__message"
            data-testid="live-follow-viewers"
            role="status"
          >
            {viewersText(session.viewers)}
          </p>
          {!session.lanFound && (
            <p className="live-follow__error" data-testid="live-follow-no-lan">
              This computer is on no network: only it can open the link.
            </p>
          )}
          <p className="modal__message share-dialog__help">
            The other device must be on the same network as this computer. If it
            cannot open the link, let Rando Atlas accept connections in your
            firewall (on Windows, allow it on private networks) or open port{" "}
            {session.port}. Turn auto-lock off on a phone that watches: its
            screen cannot be kept on from a link.
          </p>
        </>
      )}
    </section>
  );
};

export default LiveFollowSection;
