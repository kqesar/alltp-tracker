import { useState } from "react";
import { MAP_ORIENTATION_VALUES, MAP_POSITION_VALUES } from "@/constants";
import { useGameStore } from "@/stores/gameStore";

type BigKeyToggleProps = {
  /** Whether big keys are currently visible */
  isVisible: boolean;
  /** Callback to toggle big key visibility */
  onToggle: (visible: boolean) => void;
};

/**
 * BigKeyToggle component - A floating panel with tracker controls
 * Positioned over the tracker grid for easy access during gameplay
 * Includes: Reset layout, Big key toggle, Map orientation, Map position
 */
export const BigKeyToggle = ({ isVisible, onToggle }: BigKeyToggleProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isResetHovered, setIsResetHovered] = useState(false);
  const [isOrientationHovered, setIsOrientationHovered] = useState(false);
  const [isPositionHovered, setIsPositionHovered] = useState(false);

  const resetItemLayout = useGameStore((state) => state.resetItemLayout);
  const mapOrientation = useGameStore((state) => state.mapOrientation);
  const mapPosition = useGameStore((state) => state.mapPosition);
  const toggleMapOrientation = useGameStore(
    (state) => state.toggleMapOrientation,
  );
  const cycleMapPosition = useGameStore((state) => state.cycleMapPosition);

  const handleClick = () => {
    onToggle(!isVisible);
  };

  // Get display text for map position
  const getMapPositionText = () => {
    switch (mapPosition) {
      case MAP_POSITION_VALUES.SIDE:
        return "Side";
      case MAP_POSITION_VALUES.TOP:
        return "Top";
      case MAP_POSITION_VALUES.BOTTOM:
        return "Bottom";
      default:
        return "Side";
    }
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

      <button
        aria-label={`Switch map to ${mapOrientation === MAP_ORIENTATION_VALUES.HORIZONTAL ? "vertical" : "horizontal"} orientation`}
        className={`bigkey-toggle ${isOrientationHovered ? "bigkey-toggle--hover" : ""}`}
        onClick={toggleMapOrientation}
        onMouseEnter={() => setIsOrientationHovered(true)}
        onMouseLeave={() => setIsOrientationHovered(false)}
        title={`Map: ${mapOrientation === MAP_ORIENTATION_VALUES.HORIZONTAL ? "Horizontal" : "Vertical"}`}
        type="button"
      >
        <div className="bigkey-toggle__icon">
          <svg
            aria-hidden="true"
            className="bigkey-toggle__reset-icon"
            focusable="false"
            viewBox="0 0 24 24"
          >
            {mapOrientation === MAP_ORIENTATION_VALUES.HORIZONTAL ? (
              <path d="M4 4h16v2H4V4zm0 14h16v2H4v-2zm0-7h16v2H4v-2z" />
            ) : (
              <path d="M4 4h2v16H4V4zm14 0h2v16h-2V4zm-7 0h2v16h-2V4z" />
            )}
          </svg>
        </div>
        <span className="bigkey-toggle__text">
          Map:{" "}
          {mapOrientation === MAP_ORIENTATION_VALUES.HORIZONTAL
            ? "Horizontal"
            : "Vertical"}
        </span>
      </button>

      <button
        aria-label={`Change map position (current: ${getMapPositionText()})`}
        className={`bigkey-toggle ${isPositionHovered ? "bigkey-toggle--hover" : ""}`}
        onClick={cycleMapPosition}
        onMouseEnter={() => setIsPositionHovered(true)}
        onMouseLeave={() => setIsPositionHovered(false)}
        title={`Map Position: ${getMapPositionText()}`}
        type="button"
      >
        <div className="bigkey-toggle__icon">
          <svg
            aria-hidden="true"
            className="bigkey-toggle__reset-icon"
            focusable="false"
            viewBox="0 0 24 24"
          >
            {mapPosition === MAP_POSITION_VALUES.SIDE && (
              <path d="M3 3h8v18H3V3zm10 0h8v18h-8V3z" />
            )}
            {mapPosition === MAP_POSITION_VALUES.TOP && (
              <path d="M3 3h18v8H3V3zm0 10h18v8H3v-8z" />
            )}
            {mapPosition === MAP_POSITION_VALUES.BOTTOM && (
              <path d="M3 13h18v8H3v-8zm0-10h18v8H3V3z" />
            )}
          </svg>
        </div>
        <span className="bigkey-toggle__text">
          Position: {getMapPositionText()}
        </span>
      </button>
    </div>
  );
};
