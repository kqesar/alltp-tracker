import { useStreamStore } from "@/desktop/streamTools";

/**
 * The notice that the stream view's port changed, when the app started the
 * stream by itself at launch and the usual port was taken: the address pasted
 * into OBS no longer works, and nobody opened the dialog to see it. Styled
 * and placed like the update notice, among the page's notices, and its live
 * region stays in the page, empty, until it has something to say. Dismissing
 * it is for this launch; the dialog keeps saying it while the port is moved.
 */
const StreamMovedNotice = () => {
  const shown = useStreamStore((state) => state.movedNotice);
  const port = useStreamStore((state) => state.session?.port);
  const dismiss = useStreamStore((state) => state.dismissMovedNotice);

  return (
    <div className="notice" data-testid="stream-moved-notice" role="status">
      {shown && (
        <div className="notice__card">
          <p className="notice__message">
            The stream view's port was taken by another program, so it now uses
            port {port}. Open Stream view and paste its new address into your
            OBS source.
          </p>
          <div className="notice__actions">
            <button
              className="notice__button"
              data-testid="stream-moved-dismiss"
              onClick={dismiss}
              type="button"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StreamMovedNotice;
