import { useCallback, useEffect, useRef } from "react";

interface TouchGestureOptions {
  onTap?: (event: TouchEvent | MouseEvent) => void;
  onLongPress?: (event: TouchEvent | MouseEvent) => void;
  onSwipe?: (direction: "left" | "right" | "up" | "down") => void;
  longPressDelay?: number;
  swipeThreshold?: number;
  disabled?: boolean;
}

interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
  isLongPress: boolean;
}

/**
 * Hook for handling touch gestures on mobile devices
 * Provides tap, long press, and swipe gesture recognition
 */
export const useTouchGestures = ({
  onTap,
  onLongPress,
  onSwipe,
  longPressDelay = 500,
  swipeThreshold = 50,
  disabled = false,
}: TouchGestureOptions) => {
  const touchStateRef = useRef<TouchState>({
    isLongPress: false,
    startTime: 0,
    startX: 0,
    startY: 0,
  });
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleStart = useCallback(
    (event: TouchEvent | MouseEvent) => {
      if (disabled) return;

      const clientX =
        "touches" in event ? event.touches[0].clientX : event.clientX;
      const clientY =
        "touches" in event ? event.touches[0].clientY : event.clientY;

      touchStateRef.current = {
        isLongPress: false,
        startTime: Date.now(),
        startX: clientX,
        startY: clientY,
      };

      if (onLongPress) {
        longPressTimerRef.current = setTimeout(() => {
          touchStateRef.current.isLongPress = true;
          onLongPress(event);
        }, longPressDelay);
      }
    },
    [disabled, onLongPress, longPressDelay],
  );

  const handleEnd = useCallback(
    (event: TouchEvent | MouseEvent) => {
      if (disabled) return;

      clearLongPressTimer();

      const endTime = Date.now();
      const duration = endTime - touchStateRef.current.startTime;

      // Get end coordinates
      const clientX =
        "changedTouches" in event
          ? event.changedTouches[0].clientX
          : event.clientX;
      const clientY =
        "changedTouches" in event
          ? event.changedTouches[0].clientY
          : event.clientY;

      const deltaX = clientX - touchStateRef.current.startX;
      const deltaY = clientY - touchStateRef.current.startY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Check for swipe gesture
      if (distance > swipeThreshold && onSwipe) {
        const absDeltaX = Math.abs(deltaX);
        const absDeltaY = Math.abs(deltaY);

        if (absDeltaX > absDeltaY) {
          // Horizontal swipe
          onSwipe(deltaX > 0 ? "right" : "left");
        } else {
          // Vertical swipe
          onSwipe(deltaY > 0 ? "down" : "up");
        }
        return;
      }

      // Check for tap (short press without long press triggered)
      if (
        !touchStateRef.current.isLongPress &&
        duration < longPressDelay &&
        distance < 10
      ) {
        onTap?.(event);
      }
    },
    [
      disabled,
      clearLongPressTimer,
      longPressDelay,
      swipeThreshold,
      onSwipe,
      onTap,
    ],
  );

  const handleMove = useCallback(
    (event: TouchEvent | MouseEvent) => {
      if (disabled) return;

      const clientX =
        "touches" in event ? event.touches[0].clientX : event.clientX;
      const clientY =
        "touches" in event ? event.touches[0].clientY : event.clientY;

      const deltaX = clientX - touchStateRef.current.startX;
      const deltaY = clientY - touchStateRef.current.startY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Cancel long press if finger moves too much
      if (distance > 10) {
        clearLongPressTimer();
      }
    },
    [disabled, clearLongPressTimer],
  );

  const handleCancel = useCallback(() => {
    clearLongPressTimer();
  }, [clearLongPressTimer]);

  // Set up event listeners
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Touch events
    element.addEventListener("touchstart", handleStart as EventListener, {
      passive: false,
    });
    element.addEventListener("touchend", handleEnd as EventListener, {
      passive: false,
    });
    element.addEventListener("touchmove", handleMove as EventListener, {
      passive: false,
    });
    element.addEventListener("touchcancel", handleCancel);

    // Mouse events for desktop fallback
    element.addEventListener("mousedown", handleStart as EventListener);
    element.addEventListener("mouseup", handleEnd as EventListener);
    element.addEventListener("mousemove", handleMove as EventListener);
    element.addEventListener("mouseleave", handleCancel);

    return () => {
      element.removeEventListener("touchstart", handleStart as EventListener);
      element.removeEventListener("touchend", handleEnd as EventListener);
      element.removeEventListener("touchmove", handleMove as EventListener);
      element.removeEventListener("touchcancel", handleCancel);
      element.removeEventListener("mousedown", handleStart as EventListener);
      element.removeEventListener("mouseup", handleEnd as EventListener);
      element.removeEventListener("mousemove", handleMove as EventListener);
      element.removeEventListener("mouseleave", handleCancel);
    };
  }, [handleStart, handleEnd, handleMove, handleCancel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearLongPressTimer();
    };
  }, [clearLongPressTimer]);

  return {
    gestures: {
      onMouseDown: handleStart,
      onMouseLeave: handleCancel,
      onMouseMove: handleMove,
      onMouseUp: handleEnd,
      onTouchCancel: handleCancel,
      onTouchEnd: handleEnd,
      onTouchMove: handleMove,
      onTouchStart: handleStart,
    },
    ref: elementRef,
  };
};
