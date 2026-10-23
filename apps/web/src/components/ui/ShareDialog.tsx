import { lazy, Suspense, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { copyLink, type ShareResult } from "@/share/shareRun";

// The QR encoder is only needed once a run is shared: its chunk loads then
const QrCode = lazy(() => import("@/components/ui/QrCode"));

// Live follow on the local network, the desktop app's alone: the test is
// inline so the site's build drops the import and its chunk (docs/desktop.md)
const LiveFollowSection =
  import.meta.env.MODE === "desktop"
    ? lazy(() => import("@/desktop/LiveFollowSection"))
    : null;

type ShareDialogProps = {
  /** The share in progress (see `shareRun`), or `null` while the dialog is closed */
  share: Promise<ShareResult> | null;
  onClose: () => void;
};

/**
 * The dialog Share opens, the same for every game: how the copy went, the
 * link as a QR code (to open the run on another device), and a button to
 * copy it again, named after the snapshot it copies: in the desktop app it
 * sits under live follow's section, whose link is another. The copy itself
 * already happened, inside the Share click.
 */
export const ShareDialog = ({ share, onClose }: ShareDialogProps) => {
  const [result, setResult] = useState<ShareResult | null>(null);
  // What the last copy from the footer said, over the first copy's line
  const [again, setAgain] = useState<string | null>(null);

  useEffect(() => {
    setResult(null);
    setAgain(null);
    if (!share) return;
    let current = true;
    void share.then((done) => {
      if (current) setResult(done);
    });
    return () => {
      current = false;
    };
  }, [share]);

  const link = result?.link ?? null;
  return (
    <Modal
      footer={
        <button
          className="modal-btn modal-btn--ghost"
          data-testid="share-copy-again"
          disabled={!link}
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
      <p className="modal__message" data-testid="share-message" role="status">
        {again ?? result?.message ?? "Copying…"}
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
      {LiveFollowSection && (
        <Suspense fallback={null}>
          <LiveFollowSection />
        </Suspense>
      )}
    </Modal>
  );
};
