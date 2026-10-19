import { CloseIcon, ReloadIcon } from "@/components/ui/ToolbarIcons";
import { useUpdateStore } from "@/stores/updateStore";

/**
 * The notice that a new version of the tracker is ready. It never applies
 * itself: the player reloads when the run allows, or dismisses it. One of the
 * page's notices (`.notices`, fixed over the page), it never shifts the
 * board; early in the page, a keyboard reaches it in a few presses. The live
 * region stays in the page, empty, so screen readers announce the notice the
 * moment it fills.
 */
export const UpdatePrompt = () => {
  const apply = useUpdateStore((state) => state.apply);
  const dismiss = useUpdateStore((state) => state.dismiss);
  const label = useUpdateStore((state) => state.label);

  return (
    <div className="notice" data-testid="update-prompt" role="status">
      {apply && (
        <div className="notice__card">
          <p className="notice__message">A new version is available</p>
          <div className="notice__actions">
            <button
              className="notice__button notice__button--primary"
              data-testid="update-reload"
              onClick={apply}
              type="button"
            >
              <ReloadIcon />
              {label}
            </button>
            <button
              aria-label="Dismiss"
              className="notice__button"
              data-testid="update-dismiss"
              onClick={dismiss}
              title="Dismiss until the next visit"
              type="button"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
