import { useState } from "react";
import { useGameStore } from "@/stores/gameStore";

type BigKeyToggleProps = {
  /** Whether big keys are currently visible */
  isVisible: boolean;
  /** Callback to toggle big key visibility */
  onToggle: (visible: boolean) => void;
};

/**
 * BigKeyToggle component - A floating toggle button to show/hide big keys
 * Positioned over the tracker grid for easy access during keysanity mode
 * Also includes a reset button for item tracker layout
 */
export const BigKeyToggle = ({ isVisible, onToggle }: BigKeyToggleProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isResetHovered, setIsResetHovered] = useState(false);
  const resetItemLayout = useGameStore((state) => state.resetItemLayout);

  const handleClick = () => {
    onToggle(!isVisible);
  };

  return (
    <div className="bigkey-toggle-container">
      <button
        aria-label="Reset item tracker layout to default"
        className={`bigkey-toggle ${isResetHovered ? "bigkey-toggle--hover" : ""}`}
        onClick={resetItemLayout}
        onMouseEnter={() => setIsResetHovered(true)}
        onMouseLeave={() => setIsResetHovered(false)}
        title="Reset Item Tracker"
        type="button"
      >
        <div className="bigkey-toggle__icon">
          <svg
            aria-hidden="true"
            className="bigkey-toggle__reset-icon"
            focusable="false"
            viewBox="0 0 24 24"
          >
            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
          </svg>
        </div>
        <span className="bigkey-toggle__text">Reset Item Tracker</span>
      </button>

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
