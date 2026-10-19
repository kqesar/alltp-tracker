import { useEffect, useState } from "react";
import { headlineOf, phaseOf } from "@/autotrack/status";
import { lazyDialog } from "@/components/autotrack/lazyDialog";
import { StatusDot } from "@/components/autotrack/StatusDot";
import { PlugIcon } from "@/components/ui/ToolbarIcons";
import {
  connectSmAutotrack,
  stopSmAutotrack,
  useSmAutotrackStore,
} from "@/games/sm/autotrack/store";

/**
 * Autotracking's lifetime in the Super Metroid tracker, as ALttPR's: nothing
 * opens until the player connects; once they have, it connects again as the
 * tracker opens, and stops with it.
 */
export const useSmAutotrack = () => {
  useEffect(() => {
    if (useSmAutotrackStore.getState().connectOnStart) {
      void connectSmAutotrack();
    }
    return stopSmAutotrack;
  }, []);
};

const dialog = lazyDialog(() =>
  import("@/games/sm/components/SmAutotrackDialog").then(
    (module) => module.SmAutotrackDialog,
  ),
);

/**
 * The toolbar's Autotracking button, its status dot beside it, which opens
 * the autotracking dialog (a chunk of its own), and the status said politely
 * as it changes.
 */
export const SmAutotrack = () => {
  const active = useSmAutotrackStore((state) => state.active);
  const elsewhere = useSmAutotrackStore((state) => state.elsewhere);
  const shown = useSmAutotrackStore((state) => state.shown);
  const unavailable = useSmAutotrackStore((state) => state.unavailable);
  const { open, shown: shownDialog } = dialog.useDialog();
  const phase = unavailable ? "problem" : phaseOf(shown, active, elsewhere);
  const headline = unavailable
    ? "Could not load: reload the page"
    : headlineOf(shown, active, elsewhere);
  // The live region, as ALttPR's: quiet while merely connecting
  const [said, setSaid] = useState("");
  const quiet =
    !elsewhere &&
    (shown.code === "idle" ||
      (phase === "busy" && shown.code !== "local-network-prompt"));
  const message = quiet ? said : `Autotracking: ${headline}`;
  if (message !== said) setSaid(message);
  return (
    <>
      <button
        {...dialog.handlers}
        aria-label={`Autotracking, ${headline}`}
        className="tracker-controls__button autotrack-button"
        data-phase={phase}
        data-testid="autotrack-button"
        onClick={open}
        title={`Autotracking: ${headline}`}
        type="button"
      >
        <span className="autotrack-icon">
          <PlugIcon />
          <StatusDot phase={phase} />
        </span>
        <span className="toolbar-label">Autotracking</span>
      </button>
      <span className="sr-only" data-testid="autotrack-live" role="status">
        {message}
      </span>
      {shownDialog}
    </>
  );
};
