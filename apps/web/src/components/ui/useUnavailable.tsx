import { type ReactNode, useId } from "react";

/**
 * The one gate of a toolbar command that cannot be used now (a button, a More
 * menu item). It stays in the tab or arrow order, so it is `aria-disabled`
 * and never `disabled`, which would drop the focus; the reason is its
 * description, and activating it only says the reason, whatever the command
 * does.
 * @param reason - Why the command is off, or null while it works
 * @param onUnavailable - Told the reason when the player activates it
 * @returns The attributes for the element, its hidden description (a child of
 * it) and `activate`, which wraps the command's own handler
 */
export const useUnavailable = (
  reason: string | null,
  onUnavailable?: (reason: string) => void,
) => {
  const reasonId = useId();
  const note: ReactNode = reason ? (
    <span hidden id={reasonId}>
      {reason}
    </span>
  ) : null;
  return {
    activate: (command: () => void) =>
      reason ? () => onUnavailable?.(reason) : command,
    attributes: reason
      ? ({ "aria-describedby": reasonId, "aria-disabled": true } as const)
      : {},
    note,
  };
};
