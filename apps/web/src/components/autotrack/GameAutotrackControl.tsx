import { useEffect, useState } from "react";
import type { GameAutotrack } from "@/autotrack/gameSession";
import { headlineOf, phaseOf } from "@/autotrack/status";
import type { lazyDialog } from "@/components/autotrack/lazyDialog";
import { StatusDot } from "@/components/autotrack/StatusDot";
import { PlugIcon } from "@/components/ui/ToolbarIcons";

/**
 * A game's autotracking lifetime, as ALttPR's: nothing opens until the
 * player connects; once they have, it connects again as the tracker opens,
 * and stops with it.
 * @param session - The game's autotracking (createGameAutotrack)
 */
export const useGameAutotrack = <Reading,>(session: GameAutotrack<Reading>) => {
  useEffect(() => {
    if (session.useStore.getState().connectOnStart) void session.connect();
    return session.stop;
  }, [session]);
};

/**
 * The toolbar's Autotracking button, its status dot beside it, which opens
 * the game's autotracking dialog (a chunk of its own, `lazyDialog`), and the
 * status said politely as it changes, quiet while merely connecting.
 * @param session - The game's autotracking
 * @param dialog - Its lazy dialog's handlers and `useDialog`
 */
export const GameAutotrackControl = <Reading,>({
  dialog,
  session,
}: {
  dialog: ReturnType<typeof lazyDialog>;
  session: GameAutotrack<Reading>;
}) => {
  const active = session.useStore((state) => state.active);
  const elsewhere = session.useStore((state) => state.elsewhere);
  const shown = session.useStore((state) => state.shown);
  const unavailable = session.useStore((state) => state.unavailable);
  const { open, shown: shownDialog } = dialog.useDialog();
  const phase = unavailable ? "problem" : phaseOf(shown, active, elsewhere);
  const headline = unavailable
    ? "Could not load: reload the page"
    : headlineOf(shown, active, elsewhere, session.seed);
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
