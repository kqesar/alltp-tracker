import { useEffect, useRef, useState } from "react";

type UseTooltipOptions = {
  /** Delay before showing tooltip (ms) */
  delay?: number;
  /** Whether tooltip should be disabled */
  disabled?: boolean;
};

/**
 * Custom hook for managing tooltip visibility and interactions
 * Provides hover and focus handlers with proper accessibility support
 */
export const useTooltip = ({
  delay = 500,
  disabled = false,
}: UseTooltipOptions = {}) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    if (disabled) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  };

  const toggleTooltip = () => {
    if (isVisible) {
      hideTooltip();
    } else {
      showTooltip();
    }
  };

  // Event handlers for trigger element
  const triggerProps = {
    onBlur: hideTooltip,
    onFocus: showTooltip,
    onMouseEnter: showTooltip,
    onMouseLeave: hideTooltip,
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    hideTooltip,
    isVisible,
    showTooltip,
    toggleTooltip,
    triggerProps,
  };
};
