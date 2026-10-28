import { useEffect, useState } from "react";
import { type ShareResult, shareRun, snapshotRun } from "@/share/shareRun";

/** A share nobody has finished: the dialog says it is copying. */
const PENDING = new Promise<ShareResult>(() => {});

/**
 * The Share dialog of a toolbar, over the run's exports. Whether it shows a
 * link follows Race Mode as it is now, not as it was when the dialog opened:
 * a dialog opened in a race (the desktop app's, for live follow) makes its
 * link when Race Mode goes off, with no copy since no click is at hand, and
 * one open when Race Mode comes on drops the link it made, which would be
 * stale if Race Mode went off again.
 * @param race - Race Mode is on or not yet known to be off
 * @param saves - The run's exports, the most complete first (see `shareRun`)
 * @returns `open` (call it inside the click: it copies the link outside a
 * race), `close`, and `share` for `ShareDialog`
 */
export const useShare = (race: boolean, saves: () => readonly string[]) => {
  const [isOpen, setIsOpen] = useState(false);
  const [share, setShare] = useState<Promise<ShareResult> | null>(null);

  useEffect(() => {
    if (race) setShare(null);
    else if (isOpen && share === null) setShare(snapshotRun(saves()));
  }, [race, isOpen, share, saves]);

  return {
    close: () => {
      setIsOpen(false);
      setShare(null);
    },
    open: () => {
      setIsOpen(true);
      setShare(race ? null : shareRun(saves()));
    },
    share: isOpen ? (share ?? PENDING) : null,
  };
};
