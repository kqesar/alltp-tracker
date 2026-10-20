import { useState } from "react";
import { useAppMenuStore } from "@/desktop/appMenu";

/**
 * The notice, on the first launch of an AppImage, offering to add the app to
 * the application menu (a downloaded AppImage installs no entry). Styled and
 * placed like the update notice, among the page's notices: it never shifts the
 * board and its live region stays in the page, empty, until it has something
 * to say. "Not now" is remembered: it is not shown again, and the More menu
 * keeps the choice.
 */
const AppMenuPrompt = () => {
  const state = useAppMenuStore((store) => store.state);
  const asked = useAppMenuStore((store) => store.asked);
  const error = useAppMenuStore((store) => store.error);
  const change = useAppMenuStore((store) => store.change);
  const answer = useAppMenuStore((store) => store.answer);
  const [busy, setBusy] = useState(false);
  const shown = state?.available === true && !state.added && !asked;

  const add = async () => {
    setBusy(true);
    await change(true);
    setBusy(false);
  };

  return (
    <div className="notice" data-testid="app-menu-prompt" role="status">
      {shown && (
        <div className="notice__card">
          <p className="notice__message">
            Add Rando Atlas to your application menu?
            {error && ` It could not be added: ${error}`}
          </p>
          <div className="notice__actions">
            <button
              className="notice__button notice__button--primary"
              data-testid="app-menu-add"
              disabled={busy}
              onClick={add}
              type="button"
            >
              Add
            </button>
            <button
              className="notice__button"
              data-testid="app-menu-later"
              onClick={answer}
              type="button"
            >
              Not now
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppMenuPrompt;
