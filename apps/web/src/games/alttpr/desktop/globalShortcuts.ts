// The desktop app's global shortcuts, page side: the keys the player bound
// are registered by the app's Rust side (src-tauri/src/shortcuts/), which
// tells the page when one is pressed. Imported only in the desktop build, so
// the site never downloads it.
//
// Three mechanisms (the app picks, `Mechanism.kind`), and the page's policy
// differs by what each can take:
//   hotkeys  the system grabs the keys at once: every change is applied (after
//            a short pause), and nothing is grabbed while a key is captured
//   portal   the desktop asks the player to approve what is registered, so the
//            page applies only at the moments the player expects it
//   command  nothing to register: the player binds `alltp-tracker --step ...`
//            in the window manager

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  ACTIONS,
  type ActionId,
  controlTitle,
  parseAction,
} from "@/games/alttpr/data/keymap";
import {
  type Mechanism,
  type Report,
  useGlobalShortcutsStore,
} from "@/games/alttpr/desktop/globalShortcutsStore";
import {
  isControlShown,
  stepControl,
} from "@/games/alttpr/hooks/useItemShortcuts";

/** One global binding, as the app's `global_shortcuts_apply` takes it. */
export type Binding = { action: ActionId; chord: string; description: string };

type Ready = { mechanism: Mechanism; pending: string[] };

/** How long a burst of changes waits before the keys are registered. */
export const APPLY_DELAY_MS = 200;

const KNOWN = new Set<string>(ACTIONS);

/**
 * A global key press, run as the browser's key press is: the same
 * `isControlShown` and `stepControl`. It ignores the window's shortcut switch
 * and the dialogs: the player is in the emulator, and the global switch
 * already decided what is registered. A step from the command line always
 * runs: the player bound it on purpose.
 * @param action - e.g. "advance:hookshot"
 */
export const runGlobalStep = (action: string) => {
  if (!KNOWN.has(action)) return;
  const { control, direction } = parseAction(action as ActionId);
  if (!isControlShown(control)) return;
  stepControl(control, direction === "back" ? -1 : 1);
};

/** What a binding does, in the words the desktop shows beside the key. */
const describe = (action: ActionId) => {
  const { control, direction } = parseAction(action);
  return `${controlTitle(control)} ${direction === "back" ? "back" : "forward"}`;
};

/**
 * The bindings the app should hold now: none while the switch is off, in
 * command mode (nothing to register) and, with the system's own hotkeys,
 * while a key is being captured (a grab would eat the key pressed).
 */
export const wantedBindings = (
  state = useGlobalShortcutsStore.getState(),
): Binding[] => {
  const kind = state.mechanism?.kind;
  if (!state.enabled || !kind || kind === "command") return [];
  if (kind === "hotkeys" && state.capturing) return [];
  return (Object.entries(state.keymap) as [ActionId, string][])
    .filter(([action]) => KNOWN.has(action))
    .map(([action, chord]) => ({
      action,
      chord,
      description: describe(action),
    }));
};

const fingerprint = (bindings: Binding[]) =>
  JSON.stringify(bindings.map(({ action, chord }) => [action, chord]).sort());

/** The bindings the app was last given. */
let applied = fingerprint([]);

/**
 * Ask the app to hold exactly the bindings wanted now. Never throws: a
 * refusal or a failure goes to the store for the Global tab to say.
 * @param rebind - Portal only: a new session, which asks the player again
 */
export const syncGlobalShortcuts = async (rebind = false) => {
  const store = useGlobalShortcutsStore;
  const bindings = wantedBindings();
  const asksPlayer = store.getState().mechanism?.kind === "portal";
  if (asksPlayer && bindings.length > 0) store.setState({ pending: true });
  try {
    const report = await invoke<Report>("global_shortcuts_apply", {
      bindings,
      rebind,
    });
    applied = fingerprint(bindings);
    store.setState({
      failure: null,
      mechanism: report.mechanism,
      pending: false,
      report,
    });
  } catch (error) {
    store.setState({ failure: String(error), pending: false });
  }
};

/** Whether the bindings wanted differ from those the app holds. */
export const hasUnsentChanges = () => fingerprint(wantedBindings()) !== applied;

/**
 * Portal: send what changed, when the player has finished choosing (the tab or
 * the dialog closes). The system's own hotkeys apply as the player edits.
 */
export const syncIfChanged = () => {
  const portal =
    useGlobalShortcutsStore.getState().mechanism?.kind === "portal";
  if (portal && hasUnsentChanges()) void syncGlobalShortcuts();
};

/** Portal: open the desktop's own settings for the tracker's shortcuts. */
export const openDesktopSettings = async () => {
  try {
    await invoke("global_shortcuts_configure");
  } catch (error) {
    useGlobalShortcutsStore.setState({ failure: String(error) });
  }
};

let timer: ReturnType<typeof setTimeout> | undefined;

const onChange = (
  state: ReturnType<typeof useGlobalShortcutsStore.getState>,
  previous: typeof state,
) => {
  if (
    state.enabled === previous.enabled &&
    state.keymap === previous.keymap &&
    state.capturing === previous.capturing
  ) {
    return;
  }
  const kind = state.mechanism?.kind;
  if (kind === "hotkeys") {
    clearTimeout(timer);
    // Starting a capture releases the keys at once; the rest waits a moment,
    // which also folds a capture and its conflict answer into one request
    if (state.capturing && !previous.capturing) void syncGlobalShortcuts();
    else timer = setTimeout(() => void syncGlobalShortcuts(), APPLY_DELAY_MS);
  } else if (kind === "portal" && !state.enabled && previous.enabled) {
    // Turning the switch off takes the keys back at once
    void syncGlobalShortcuts();
  }
};

/** Stop acting on changes; for tests. */
export const stopGlobalShortcuts = () => {
  clearTimeout(timer);
  timer = undefined;
};

/**
 * Start the global shortcuts: listen for key presses, learn what the app can
 * do, run the steps that waited for the page, then register the saved keys.
 */
export const startGlobalShortcuts = async () => {
  await listen<{ action: string }>("global-step", ({ payload }) =>
    runGlobalStep(payload.action),
  );
  await listen<{ bindings: { action: string; trigger: string | null }[] }>(
    "global-shortcuts-changed",
    ({ payload }) => {
      const { report } = useGlobalShortcutsStore.getState();
      if (!report) return;
      useGlobalShortcutsStore.setState({
        report: {
          ...report,
          bindings: report.bindings.map((binding) => ({
            ...binding,
            trigger:
              payload.bindings.find(
                (changed) => changed.action === binding.action,
              )?.trigger ?? binding.trigger,
          })),
        },
      });
    },
  );
  const { mechanism, pending } = await invoke<Ready>("global_shortcuts_ready");
  useGlobalShortcutsStore.setState({ mechanism });
  for (const action of pending) runGlobalStep(action);
  await syncGlobalShortcuts();
  useGlobalShortcutsStore.subscribe(onChange);
};
