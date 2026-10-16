import type { Page } from "@playwright/test";

/** Phone, tablet, laptop and desktop: the widths every layout must hold at. */
export const WIDTHS = [390, 820, 1440, 1920] as const;

/** The accessibility standard every page state is held to. */
export const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/**
 * Clickable-looking elements a keyboard can never reach.
 * @param within - Where to look: the page, or an open dialog
 */
export const unreachableClickables = (page: Page, within = "body") =>
  page.evaluate(
    (root) =>
      [...document.querySelectorAll(`${root} *`)]
        .filter(
          (element) =>
            getComputedStyle(element).cursor === "pointer" &&
            (element as HTMLElement).tabIndex < 0 &&
            !element.closest("button, a, label, summary, input, select"),
        )
        .map(
          (element) => element.getAttribute("data-testid") ?? element.className,
        ),
    within,
  );
