import { type KeyboardEvent, type MouseEvent, useRef } from "react";
import type { Direction } from "@/stores/gameStore";

/**
 * Handlers for a control that steps through values: click (or Enter / Space)
 * steps forward, right-click or the "-" key steps back. A touch long-press,
 * which browsers also report as `contextmenu`, does nothing rather than
 * stepping back by surprise.
 * @param step - Moves the value one step in the given direction
 */
export const useStepHandlers = (step: (direction: Direction) => void) => {
  const pointerType = useRef("mouse");

  return {
    "aria-keyshortcuts": "-",
    onClick: () => step(1),
    onContextMenu: (event: MouseEvent) => {
      event.preventDefault();
      if (pointerType.current !== "touch") step(-1);
    },
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key !== "-" || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      step(-1);
    },
    onPointerDown: (event: { pointerType: string }) => {
      pointerType.current = event.pointerType;
    },
  };
};
