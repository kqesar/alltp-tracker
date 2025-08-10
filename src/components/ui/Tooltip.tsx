import { useCallback, useEffect, useRef, useState } from "react";
import type { DungeonTooltipData, TooltipData } from "@/data/tooltips";

type TooltipProps = {
  /** Tooltip data to display */
  data: TooltipData | DungeonTooltipData;
  /** Element that triggers the tooltip */
  children: React.ReactNode;
  /** Tooltip position relative to trigger */
  position?: "top" | "bottom" | "left" | "right";
  /** Delay before showing tooltip (ms) */
  delay?: number;
  /** Whether tooltip is currently visible */
  visible?: boolean;
  /** Callback when visibility changes */
  onVisibilityChange?: (visible: boolean) => void;
};

/**
 * Tooltip component that displays contextual help information
 * Supports hover and focus interactions with keyboard accessibility
 */
export const Tooltip = ({
  data,
  children,
  position = "top",
  delay = 500,
  visible,
  onVisibilityChange,
}: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use controlled visibility if provided, otherwise use internal state
  const showTooltip = visible !== undefined ? visible : isVisible;

  const updateTooltipPosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewport = {
      height: window.innerHeight,
      width: window.innerWidth,
    };

    let x = 0;
    let y = 0;

    switch (position) {
      case "top":
        x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        y = triggerRect.top - tooltipRect.height - 8;
        break;
      case "bottom":
        x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        y = triggerRect.bottom + 8;
        break;
      case "left":
        x = triggerRect.left - tooltipRect.width - 8;
        y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        break;
      case "right":
        x = triggerRect.right + 8;
        y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        break;
    }

    // Keep tooltip within viewport bounds
    x = Math.max(8, Math.min(x, viewport.width - tooltipRect.width - 8));
    y = Math.max(8, Math.min(y, viewport.height - tooltipRect.height - 8));

    setTooltipPosition({ x, y });
  }, [position]);

  const showTooltipWithDelay = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      if (visible === undefined) {
        setIsVisible(true);
      }
      onVisibilityChange?.(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (visible === undefined) {
      setIsVisible(false);
    }
    onVisibilityChange?.(false);
  };

  const handleMouseEnter = () => {
    showTooltipWithDelay();
  };

  const handleMouseLeave = () => {
    hideTooltip();
  };

  const handleFocus = () => {
    showTooltipWithDelay();
  };

  const handleBlur = () => {
    hideTooltip();
  };

  useEffect(() => {
    if (showTooltip) {
      updateTooltipPosition();
    }
  }, [showTooltip, updateTooltipPosition]);

  useEffect(() => {
    if (showTooltip) {
      const handleResize = () => updateTooltipPosition();
      const handleScroll = () => updateTooltipPosition();

      window.addEventListener("resize", handleResize);
      window.addEventListener("scroll", handleScroll);

      return () => {
        window.removeEventListener("resize", handleResize);
        window.removeEventListener("scroll", handleScroll);
      };
    }
  }, [showTooltip, updateTooltipPosition]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const isDungeonData = (
    data: TooltipData | DungeonTooltipData,
  ): data is DungeonTooltipData => {
    return "chestCount" in data;
  };

  return (
    <>
      <div
        className="tooltip-trigger"
        onBlur={handleBlur}
        onFocus={handleFocus}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        ref={triggerRef}
      >
        {children}
      </div>

      {showTooltip && (
        <div
          aria-live="polite"
          className={`tooltip tooltip--${position}`}
          ref={tooltipRef}
          role="tooltip"
          style={{
            left: tooltipPosition.x,
            position: "fixed",
            top: tooltipPosition.y,
            zIndex: 1000,
          }}
        >
          <div className="tooltip__content">
            <h3 className="tooltip__title">{data.title}</h3>
            <p className="tooltip__description">{data.description}</p>

            {data.mechanics && (
              <div className="tooltip__section">
                <h4 className="tooltip__section-title">Mechanics</h4>
                <p className="tooltip__section-content">{data.mechanics}</p>
              </div>
            )}

            {isDungeonData(data) && data.requirements && (
              <div className="tooltip__section">
                <h4 className="tooltip__section-title">Requirements</h4>
                <ul className="tooltip__list">
                  {data.requirements.map((req) => (
                    <li className="tooltip__list-item" key={req}>
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {isDungeonData(data) && data.medallion && (
              <div className="tooltip__section">
                <h4 className="tooltip__section-title">Medallion</h4>
                <p className="tooltip__section-content">{data.medallion}</p>
              </div>
            )}

            {isDungeonData(data) && data.chestCount !== undefined && (
              <div className="tooltip__section">
                <h4 className="tooltip__section-title">Chests</h4>
                <p className="tooltip__section-content">
                  {data.chestCount} total chests
                </p>
              </div>
            )}

            {data.tips && (
              <div className="tooltip__section">
                <h4 className="tooltip__section-title">Tips</h4>
                <p className="tooltip__section-content tooltip__tips">
                  {data.tips}
                </p>
              </div>
            )}

            {data.shortcuts && (
              <div className="tooltip__section">
                <h4 className="tooltip__section-title">Shortcuts</h4>
                <ul className="tooltip__list">
                  {data.shortcuts.map((shortcut) => (
                    <li
                      className="tooltip__list-item tooltip__shortcut"
                      key={shortcut}
                    >
                      {shortcut}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className={`tooltip__arrow tooltip__arrow--${position}`} />
        </div>
      )}
    </>
  );
};
