import { type RefObject, useLayoutEffect } from "react";

/** The custom property the notices' room is kept in: scroll padding. */
export const NOTICES_ROOM = "--notices-room";
/** The custom property the page's padding under the board is kept in. */
export const NOTICES_PAD = "--notices-pad";

/**
 * Keep room at the bottom of the page for the notices (`.notices`), which
 * are fixed over it, so a notice never hides the focus (WCAG 2.4.11): a
 * control focused under them is scrolled above (`scroll-padding`, ui.css,
 * the notices' height and the gap under them), and the page is padded by
 * just what lets the board's end scroll clear of them. A board that ends
 * above them adds no scroll; none of it while every notice is empty. Both
 * are measured as the notices, the board and the viewport change.
 * @param notices - The notices' container
 * @param main - The board's container, whose end the notices may cover
 */
export const useNoticesRoom = (
  notices: RefObject<HTMLElement | null>,
  main: RefObject<HTMLElement | null>,
) => {
  useLayoutEffect(() => {
    const shown = notices.current;
    const board = main.current;
    if (shown === null || board === null) return;
    const root = document.documentElement;
    const measure = () => {
      const box = shown.getBoundingClientRect();
      // From the notices' top to the viewport's bottom: their height, the
      // gap and the safe area under them
      const room = box.height === 0 ? 0 : Math.max(0, innerHeight - box.top);
      // The page's height the board needs to scroll clear of them, against
      // the height it has without padding
      const end = board.getBoundingClientRect().bottom + scrollY;
      const pad = Math.max(0, end + room - Math.max(innerHeight, end));
      root.style.setProperty(NOTICES_ROOM, `${room}px`);
      root.style.setProperty(NOTICES_PAD, `${pad}px`);
    };
    measure();
    // jsdom has no ResizeObserver: the page's size alone is followed there
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(shown);
    observer?.observe(board);
    addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      removeEventListener("resize", measure);
      root.style.removeProperty(NOTICES_ROOM);
      root.style.removeProperty(NOTICES_PAD);
    };
  }, [notices, main]);
};
