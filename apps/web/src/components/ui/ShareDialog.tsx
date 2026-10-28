import { lazy, Suspense, useEffect, useId, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { RACE_SHARE_NOTE } from "@/share/raceShare";
import { copyFullLink, copyLink, type ShareResult } from "@/share/shareRun";

// The QR encoder is only needed once a run is shared: its chunk loads then
const QrCode = lazy(() => import("@/components/ui/QrCode"));

// Live follow on the local network, the desktop app's alone: the test is
// inline so the site's build drops the import and its chunk (docs/desktop.md)
const LiveFollowSection =
  import.meta.env.MODE === "desktop"
    ? lazy(() => import("@/desktop/LiveFollowSection"))
    : null;

type ShareDialogProps = {
  /**
   * Race Mode is on or not yet known to be off: no link is shown, whatever
   * `share` holds, and the dialog says why (live follow stays, in the desktop
   * app)
   */
  race?: boolean;
  /** The share in progress (see `shareRun`), or `null` while the dialog is closed */
  share: Promise<ShareResult> | null;
  onClose: () => void;
};

/**
 * The dialog Share opens, the same for every game: how the copy went, the
 * link as a QR code (to open the run on another device), and a button to
 * copy it again, named after the snapshot it copies: in the desktop app it
 * sits under live follow's section, whose link is another. The copy itself
 * already happened, inside the Share click. When that link is a shortened
 * one (ALttPR's, without the timeline), a second button copies the full one.
 */
export const ShareDialog = ({
  race = false,
  share,
  onClose,
}: ShareDialogProps) => {
  const [result, setResult] = useState<ShareResult | null>(null);
  // What the last copy from a button said, over the first copy's line
  const [again, setAgain] = useState<string | null>(null);
  // A shortened link came: its full form's button stays until the dialog
  // closes, off in a race, so Race Mode coming on drops no focus from it
  const [offersFull, setOffersFull] = useState(false);
  const messageId = useId();
  const fullId = useId();

  useEffect(() => {
    setResult(null);
    setAgain(null);
    if (!share) {
      setOffersFull(false);
      return;
    }
    let current = true;
    void share.then((done) => {
      if (!current) return;
      setResult(done);
      if (done.link?.full) setOffersFull(true);
    });
    return () => {
      current = false;
    };
  }, [share]);

  const link = race ? null : (result?.link ?? null);
  const full = link?.full ?? null;
  return (
    <Modal
      footer={
        // Off while there is no link (in a race, or while it is made) but never
        // `disabled`, which would drop a focus on it to the page behind the dialog
        <button
          aria-describedby={race ? messageId : undefined}
          aria-disabled={link ? undefined : true}
          className="modal-btn modal-btn--ghost"
          data-testid="share-copy-again"
          onClick={() => {
            if (link) void copyLink(link).then(setAgain);
          }}
          type="button"
        >
          Copy the snapshot link
        </button>
      }
      isOpen={share !== null}
      onClose={onClose}
      title="Share this run"
    >
      <p
        className="modal__message"
        data-testid="share-message"
        id={messageId}
        role="status"
      >
        {race ? RACE_SHARE_NOTE : (again ?? result?.message ?? "Copying…")}
      </p>
      {link && (
        <>
          <Suspense fallback={<div className="share-qr" />}>
            <QrCode label="QR code of the link to this run" text={link.url} />
          </Suspense>
          <p className="modal__message share-dialog__help">
            Scan it to open this run on another device. It is a snapshot: it
            does not follow the game.
          </p>
        </>
      )}
      {offersFull && (
        <div className="share-full" data-testid="share-full">
          {full !== null && (
            <p className="modal__message share-dialog__help" id={fullId}>
              To fit a chat message, this link leaves out the timeline: when
              each thing was found, which a review of the run reads. The full
              link keeps it, in {full.length} characters, which some chat apps
              cut.
            </p>
          )}
          <button
            aria-describedby={
              full !== null ? fullId : race ? messageId : undefined
            }
            aria-disabled={full !== null ? undefined : true}
            className="modal-btn modal-btn--ghost"
            data-testid="share-copy-full"
            onClick={() => {
              if (full !== null) void copyFullLink(full).then(setAgain);
            }}
            type="button"
          >
            Copy the full link (with the timeline)
          </button>
        </div>
      )}
      {LiveFollowSection && (
        <Suspense fallback={null}>
          <LiveFollowSection />
        </Suspense>
      )}
    </Modal>
  );
};
