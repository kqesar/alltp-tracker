import type { ReactNode } from "react";
import { useUnavailable } from "@/components/ui/useUnavailable";

type ToolbarActionProps = {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  /** Told the reason when the player activates the action while it is off */
  onUnavailable?: (reason: string) => void;
  testId?: string;
  title: string;
  /** Why the action cannot be used now, or null (`useUnavailable`) */
  unavailable?: string | null;
};

/**
 * A secondary action of the run toolbar: its icon and its label, which the
 * bar's fit hides before any other (ui.css). While `unavailable` it never
 * calls `onClick`.
 */
export const ToolbarAction = ({
  icon,
  label,
  onClick,
  onUnavailable,
  testId,
  title,
  unavailable = null,
}: ToolbarActionProps) => {
  const { activate, attributes, note } = useUnavailable(
    unavailable,
    onUnavailable,
  );
  return (
    <button
      {...attributes}
      className="tracker-controls__button"
      data-testid={testId}
      onClick={activate(onClick)}
      title={unavailable ?? title}
      type="button"
    >
      {icon}
      <span className="toolbar-label">{label}</span>
      {note}
    </button>
  );
};
