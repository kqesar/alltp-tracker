import { type RefObject, useLayoutEffect } from "react";

/** The custom property the page's room under the notices is kept in. */
export const NOTICES_ROOM = "--notices-room";

/**
 * Keep room at the bottom of the page for the notices (`.notices`), which
 * are fixed over it: the page's end can scroll clear of them, and a control
 * focused there is scrolled above them (`scroll-padding`, ui.css), so a
 * notice never hides the focus (WCAG 2.4.11). The room is the notices' own
 * height and the gap under them, measured as they change; none while every
 * notice is empty.
 * @param ref - The notices' container
 */
export const useNoticesRoom = (ref: RefObject<HTMLElement | null>) => {
  useLayoutEffect(() => {
    const notices = ref.current;
    if (notices === null) return;
    const root = document.documentElement;
    const measure = () => {
      const box = notices.getBoundingClientRect();
      // From the notices' top to the viewport's bottom: their height, the
      // gap and the safe area under them
      const room = box.height === 0 ? 0 : innerHeight - box.top;
      root.style.setProperty(NOTICES_ROOM, `${Math.max(0, room)}px`);
    };
    measure();
    // jsdom has no ResizeObserver: the page's size alone is followed there
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(notices);
    addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      removeEventListener("resize", measure);
      root.style.removeProperty(NOTICES_ROOM);
    };
  }, [ref]);
};
