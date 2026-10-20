import "@/desktop/appMenu.css";
import { ToolbarMenuItem } from "@/components/ui/ToolbarMenu";
import { useAppMenuStore } from "@/desktop/appMenu";

/** Four tiles, the fourth a plus: an app added to the grid of apps. */
const AppsIcon = () => (
  <svg
    aria-hidden="true"
    className="toolbar-icon"
    fill="none"
    focusable="false"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM17 14v6M14 17h6" />
  </svg>
);

/**
 * The More menu's item that adds the AppImage to the application menu or
 * removes it, by how it stands. Nothing renders where the app cannot offer it
 * (a package, Windows, macOS: they install their own entry).
 *
 * The wrapper is what appMenu.css looks for: with this item in it, the More
 * button shows at every width, since the bar's own buttons stand in for the
 * menu's other items until the toolbar folds them.
 * @param onStatus - Says the outcome in the toolbar's status line
 */
const AppMenuItem = ({ onStatus }: { onStatus: (message: string) => void }) => {
  const state = useAppMenuStore((store) => store.state);
  const change = useAppMenuStore((store) => store.change);
  if (!state?.available) return null;

  const toggle = async () => {
    const worked = await change(!state.added);
    if (!worked) onStatus("The application menu could not be changed.");
    else if (state.added) onStatus("Removed from the application menu.");
    else onStatus("Added to the application menu.");
  };

  return (
    <div className="app-menu-entry" role="none">
      <ToolbarMenuItem
        icon={<AppsIcon />}
        label={
          state.added
            ? "Remove from application menu"
            : "Add to application menu"
        }
        onSelect={toggle}
        testId="toolbar-more-app-menu"
      />
    </div>
  );
};

export default AppMenuItem;
