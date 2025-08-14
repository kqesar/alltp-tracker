import { useState } from "react";

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
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    onToggle(!isVisible);
  };

  return (
    <div className="bigkey-toggle-container">
      <button
        aria-label={isVisible ? "Hide big keys" : "Show big keys"}
        className={`bigkey-toggle ${isVisible ? "bigkey-toggle--active" : ""} ${isHovered ? "bigkey-toggle--hover" : ""}`}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        title={isVisible ? "Hide big keys" : "Show big keys"}
        type="button"
      >
        <div className="bigkey-toggle__icon">
          <div className="bigkey-toggle__key-icon" />
          {!isVisible && <div className="bigkey-toggle__slash" />}
        </div>
        <span className="bigkey-toggle__text">
          {isVisible ? "Hide" : "Show"} Big Keys
        </span>
      </button>
    </div>
  );
};
