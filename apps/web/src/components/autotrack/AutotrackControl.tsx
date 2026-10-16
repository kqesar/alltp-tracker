import { type ComponentType, useState } from "react";
import { headlineOf, phaseOf } from "@/autotrack/status";
import { RaceBadge, StatusDot } from "@/components/autotrack/StatusDot";
import { Modal } from "@/components/ui/Modal";
import { PlugIcon } from "@/components/ui/ToolbarIcons";
import { ToolbarMenuItem } from "@/components/ui/ToolbarMenu";
import { useAutotrackStore } from "@/stores/autotrackStore";

type Dialog = ComponentType<{ onClose: () => void }>;

let loading: Promise<Dialog> | undefined;

/** The dialog, once its code has arrived. */
let loaded: Dialog | undefined;

/**
 * Fetch the autotracking dialog's code, once: a chunk of its own (the setup
 * guide's text and the readout), asked for as soon as a pointer or focus
 * reaches a control that opens it. A failed fetch is forgotten, for the next
 * try.
 */
export const preloadAutotrackDialog = () => {
  loading ??= import("@/components/autotrack/AutotrackDialog").then(
    (module) => {
      loaded = module.AutotrackDialog;
      return loaded;
    },
    (error) => {
      loading = undefined;
      throw error;
    },
  );
  return loading;
};

const preload = {
  onFocus: () => void preloadAutotrackDialog().catch(() => {}),
  onPointerDown: () => void preloadAutotrackDialog().catch(() => {}),
  onPointerEnter: () => void preloadAutotrackDialog().catch(() => {}),
};

/**
 * Shown when the dialog's code cannot be fetched: offline before it was ever
 * cached, or a release since this page loaded has replaced it.
 */
const AutotrackUnavailable = ({ onClose }: { onClose: () => void }) => (
  <Modal
    footer={
      <>
        <button
          className="modal-btn modal-btn--ghost"
          onClick={onClose}
          type="button"
        >
          Close
        </button>
        <button
          className="modal-btn modal-btn--primary"
          data-autofocus
          onClick={() => window.location.reload()}
          type="button"
        >
          Reload
        </button>
      </>
    }
    isOpen
    onClose={onClose}
    title="Autotracking"
  >
    <p className="modal__message">
      Autotracking could not be loaded. Reload the page to try again; your run
      is saved.
    </p>
  </Modal>
);

/** The status as the toolbar shows it: the dot's phase, its words, the race. */
const useAutotrackSummary = () => {
  const active = useAutotrackStore((state) => state.active);
  const shown = useAutotrackStore((state) => state.shown);
  const unavailable = useAutotrackStore((state) => state.unavailable);
  return {
    headline: unavailable
      ? "Could not load: reload the page"
      : headlineOf(shown, active),
    phase: unavailable ? ("problem" as const) : phaseOf(shown, active),
    race:
      active && shown.code === "connected" && shown.race.active
        ? shown.race
        : null,
  };
};

/**
 * The toolbar's Autotracking control: a plug with the status dot, which
 * opens the autotracking dialog (setup, connection, what was read). Its name
 * says the status; the race-legal badge shows while Race Mode is on. The
 * dialog never opens by itself: connecting, losing the bridge and
 * reconnecting change the dot and the live region only.
 * @param variant - A toolbar button, or an item of the toolbar's More menu
 */
export const AutotrackControl = ({
  variant = "toolbar",
}: {
  variant?: "toolbar" | "menu";
}) => {
  const { headline, phase, race } = useAutotrackSummary();
  const [isOpen, setIsOpen] = useState(false);
  // Not React.lazy: a dialog whose code has arrived opens in the same frame
  // as the click (see ShortcutsButton)
  const [dialog, setDialog] = useState<{ Component: Dialog } | null>(null);

  const open = () => {
    setIsOpen(true);
    if (loaded) {
      setDialog({ Component: loaded });
      return;
    }
    preloadAutotrackDialog().then(
      (Component) => setDialog({ Component }),
      () => setDialog({ Component: AutotrackUnavailable }),
    );
  };
  const Shown = isOpen ? dialog?.Component : undefined;
  const icon = (
    <span className="autotrack-icon">
      <PlugIcon />
      <StatusDot phase={phase} />
    </span>
  );

  return (
    <>
      {variant === "menu" ? (
        <ToolbarMenuItem
          {...preload}
          detail={race ? `${headline}, race-legal` : headline}
          icon={icon}
          label="Autotracking"
          onSelect={open}
          testId="toolbar-more-autotrack"
        />
      ) : (
        <button
          {...preload}
          // Its words and badge are flex items, which browsers name with
          // spaces between them: one name, in the order they show
          aria-label={`Autotracking, ${headline}${race ? ", race-legal" : ""}`}
          className="tracker-controls__button autotrack-button"
          data-phase={phase}
          data-testid="autotrack-button"
          onClick={open}
          title={`Autotracking: ${headline}`}
          type="button"
        >
          {icon}
          <span className="toolbar-label">Autotracking</span>
          {race && <RaceBadge race={race} />}
        </button>
      )}
      {Shown && <Shown onClose={() => setIsOpen(false)} />}
    </>
  );
};

/**
 * The More button's copy of the status dot, for a bar so narrow that the
 * control folds into the menu (toolbar-menu.css shows it then only), so the
 * status stays in view during the run. A screen reader hears the status from
 * the live region and from the menu's Autotracking item instead.
 */
export const AutotrackMoreBadge = () => {
  const { phase } = useAutotrackSummary();
  return (
    <span
      aria-hidden="true"
      className="toolbar-more__badge"
      data-testid="toolbar-more-badge"
    >
      <StatusDot phase={phase} />
    </span>
  );
};

/**
 * Says the status to screen readers as it changes, politely: never while it
 * only passes through connecting or attaching, so a run is not narrated, but
 * when it connects, fails, needs the browser's prompt answered, or stops.
 * Outside the control, so a folded control still speaks.
 */
export const AutotrackLiveRegion = () => {
  const { headline, phase } = useAutotrackSummary();
  const shown = useAutotrackStore((state) => state.shown);
  const [said, setSaid] = useState("");
  const quiet =
    shown.code === "idle" ||
    (phase === "busy" && shown.code !== "local-network-prompt");
  const message = quiet ? said : `Autotracking: ${headline}`;
  if (message !== said) setSaid(message);

  return (
    <span className="sr-only" data-testid="autotrack-live" role="status">
      {message}
    </span>
  );
};
