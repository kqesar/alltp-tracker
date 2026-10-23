import { type Dialog, lazyDialog } from "@/components/ui/lazyDialog";

/**
 * A game's autotracking dialog (see `lazyDialog`), the player told in the
 * same words whichever game's code could not be fetched.
 * @param load - Imports the dialog's module and picks the dialog
 */
export const lazyAutotrackDialog = (load: () => Promise<Dialog>) =>
  lazyDialog(load, {
    message:
      "Autotracking could not be loaded. Reload the page to try again; your run is saved.",
    title: "Autotracking",
  });
