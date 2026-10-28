import { type ReactNode, useId } from "react";

type ToolbarActionProps = {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  testId?: string;
  title: string;
  /**
   * Why the action cannot be used now, or null. It stays in the tab order
   * (`aria-disabled`, not `disabled`, which would drop the focus) with the
   * reason as its description; `onClick` then says it to the player.
   */
  unavailable?: string | null;
};

/**
 * A secondary action of the run toolbar: its icon and its label, which the
 * bar's fit hides before any other (ui.css).
 */
export const ToolbarAction = ({
  icon,
  label,
  onClick,
  testId,
  title,
  unavailable = null,
}: ToolbarActionProps) => {
  const reasonId = useId();
  return (
    <button
      aria-describedby={unavailable ? reasonId : undefined}
      aria-disabled={unavailable ? true : undefined}
      className="tracker-controls__button"
      data-testid={testId}
      onClick={onClick}
      title={unavailable ?? title}
      type="button"
    >
      {icon}
      <span className="toolbar-label">{label}</span>
      {unavailable && (
        <span hidden id={reasonId}>
          {unavailable}
        </span>
      )}
    </button>
  );
};
