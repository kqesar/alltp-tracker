import {
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
  useRef,
} from "react";
import {
  isOnTooltip,
  scheduleHide,
  type TooltipTarget,
  useTooltipStore,
} from "@/stores/tooltipStore";

/** How long a finger must rest on a control to show its details. */
export const LONG_PRESS_MS = 450;

/** Keyboard focus shows the tooltip; focus from a click or a tap does not. */
const isKeyboardFocus = (element: HTMLElement) => {
  try {
    return element.matches(":focus-visible");
  } catch {
    return true; // an engine without :focus-visible
  }
};

/**
 * Handlers that show `target`'s tooltip on the element they are spread on:
 * on mouse hover, on keyboard focus, and on a touch long-press — a tap stays
 * the control's own action, and the click that ends a long-press is
 * swallowed so it does not also toggle the control. While the pointer is on
 * a tooltip covering this control, the tooltip shown stays (it is hoverable)
 * until the pointer leaves it.
 * @param target - What the tooltip describes
 */
export const useTooltip = (target: TooltipTarget) => {
  const pressTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const longPressed = useRef(false);

  const show = (anchor: HTMLElement) =>
    useTooltipStore.getState().show(target, anchor);
  const endPress = () => clearTimeout(pressTimer.current);

  return {
    onBlur: (event: FocusEvent<HTMLElement>) =>
      useTooltipStore.getState().hide(event.currentTarget),
    onClickCapture: (event: MouseEvent) => {
      if (!longPressed.current) return;
      longPressed.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
    onFocus: (event: FocusEvent<HTMLElement>) => {
      if (isKeyboardFocus(event.currentTarget)) show(event.currentTarget);
    },
    onPointerCancel: endPress,
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      longPressed.current = false;
      if (event.pointerType !== "touch") return;
      const anchor = event.currentTarget;
      pressTimer.current = setTimeout(() => {
        longPressed.current = true;
        show(anchor);
      }, LONG_PRESS_MS);
    },
    onPointerEnter: (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType !== "mouse") return;
      if (!isOnTooltip(event.clientX, event.clientY)) show(event.currentTarget);
    },
    onPointerLeave: (event: PointerEvent<HTMLElement>) => {
      endPress();
      if (event.pointerType === "mouse") scheduleHide(event.currentTarget);
    },
    // Off another control's tooltip and onto this one: show this one's
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType !== "mouse") return;
      const { anchor } = useTooltipStore.getState();
      if (!anchor || anchor === event.currentTarget) return;
      if (!isOnTooltip(event.clientX, event.clientY)) show(event.currentTarget);
    },
    onPointerUp: endPress,
  };
};
