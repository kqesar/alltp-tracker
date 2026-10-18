import type { MouseEvent } from "react";

/** The least room a popover keeps from the viewport's edge. */
const SCREEN_MARGIN_PX = 8;

/**
 * Put a popover under the button that opens it, from the button's left
 * edge, or from its right edge when the button sits in the right half of
 * the screen. The popover is in the top layer, out of the page's flow.
 * @param event - The click on the button
 * @param panelId - The popover's id
 */
export const placeUnder = (
  event: MouseEvent<HTMLButtonElement>,
  panelId: string,
) => {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  const box = event.currentTarget.getBoundingClientRect();
  const fromRight = box.left + box.width / 2 > window.innerWidth / 2;
  panel.style.top = `${box.bottom + SCREEN_MARGIN_PX / 2}px`;
  panel.style.left = fromRight
    ? "auto"
    : `${Math.max(box.left, SCREEN_MARGIN_PX)}px`;
  panel.style.right = fromRight
    ? `${Math.max(window.innerWidth - box.right, SCREEN_MARGIN_PX)}px`
    : "auto";
};
