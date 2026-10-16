type BigKeyToggleProps = {
  /** Whether big keys are currently visible */
  isVisible: boolean;
  /** Callback to toggle big key visibility */
  onToggle: (visible: boolean) => void;
};

/**
 * BigKeyToggle component - A floating toggle button to show/hide big keys
 * Positioned over the tracker grid for easy access during keysanity mode
 */
export const BigKeyToggle = ({ isVisible, onToggle }: BigKeyToggleProps) => {
  const handleClick = () => {
    onToggle(!isVisible);
  };

  return (
    <div className="bigkey-toggle-container" data-testid="bigkey-toggle">
      <button
        className={`bigkey-toggle ${isVisible ? "bigkey-toggle--active" : ""}`}
        data-testid="key-cells-toggle"
        onClick={handleClick}
        title={isVisible ? "Hide big keys" : "Show big keys"}
        type="button"
      >
        <span aria-hidden="true" className="bigkey-toggle__icon">
          <span className="bigkey-toggle__key-icon" />
          {!isVisible && <span className="bigkey-toggle__slash" />}
        </span>
        <span className="toolbar-label">
          {isVisible ? "Hide" : "Show"} big keys
        </span>
      </button>
    </div>
  );
};
