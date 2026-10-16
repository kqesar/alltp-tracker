import { type RefObject, useLayoutEffect } from "react";

/**
 * How much of the toolbar shows, richest first: every action with its label,
 * every action as an icon, or the actions of a run with the rest in More.
 */
export type ToolbarFit = "labels" | "icons" | "more";

/** The width the toolbar needs to hold each full form on one row. */
export type ToolbarNeeds = Record<Exclude<ToolbarFit, "more">, number>;

const RANK: Record<ToolbarFit, number> = { icons: 1, labels: 2, more: 0 };

/**
 * Room a richer form needs beyond its own width before the bar switches to
 * it. More than a classic scrollbar (15 to 17 px): one appearing as the bar
 * grows or shrinks by a row cannot then flip the bar back.
 */
export const HYSTERESIS_PX = 24;

/**
 * The richest form that fits. Falling back happens as soon as a form no
 * longer fits; moving up needs HYSTERESIS_PX to spare, so a width at the edge
 * does not make the bar switch back and forth.
 * @param available - The toolbar's width
 * @param needs - The width each full form needs
 * @param current - The form shown now, if any
 */
export const chooseFit = (
  available: number,
  needs: ToolbarNeeds,
  current?: ToolbarFit,
): ToolbarFit => {
  for (const fit of ["labels", "icons"] as const) {
    const margin = current && RANK[fit] > RANK[current] ? HYSTERESIS_PX : 0;
    if (needs[fit] + margin <= available) return fit;
  }
  return "more";
};

/**
 * Measure the width each full form of the toolbar needs, whatever the fonts,
 * zoom or labels: a hidden copy of the bar, laid out on one row at its
 * content's width, in each form. The status line is left out: it is no
 * action, and may wrap below them.
 * @param toolbar - The toolbar element
 */
export const measureNeeds = (toolbar: HTMLElement): ToolbarNeeds => {
  const probe = toolbar.cloneNode(true) as HTMLElement;
  for (const element of [
    probe,
    ...probe.querySelectorAll("[id], [data-testid]"),
  ]) {
    element.removeAttribute("id");
    element.removeAttribute("data-testid");
  }
  // Out of the radio groups: a checked copy would uncheck the real one
  for (const input of probe.querySelectorAll("input[name]")) {
    input.removeAttribute("name");
  }
  probe.querySelector(".tracker-controls__status")?.remove();
  Object.assign(probe.style, {
    flexWrap: "nowrap",
    left: "0",
    position: "absolute",
    top: "0",
    width: "max-content",
  });
  // A zero-size, clipped, invisible box: the copy never shows nor widens the page
  const stage = document.createElement("div");
  stage.setAttribute("aria-hidden", "true");
  stage.inert = true;
  Object.assign(stage.style, {
    height: "0",
    left: "0",
    overflow: "hidden",
    pointerEvents: "none",
    position: "fixed",
    top: "0",
    visibility: "hidden",
    width: "0",
  });
  stage.append(probe);
  document.body.append(stage);

  const needs: ToolbarNeeds = { icons: 0, labels: 0 };
  for (const fit of ["labels", "icons"] as const) {
    probe.dataset.fit = fit;
    needs[fit] = probe.getBoundingClientRect().width;
  }
  stage.remove();
  return needs;
};

/**
 * Fold the toolbar to the richest form that fits on one row (a Priority+
 * toolbar), from the widths it really needs rather than a breakpoint: system
 * fonts differ between macOS, Windows and Linux, and so do zoom, the user's
 * font size and, later, translations. The form is written to the toolbar's
 * `data-fit` attribute, which its CSS follows, so resizing never re-renders
 * React. It is decided before paint, again whenever the toolbar resizes, its
 * content changes or fonts finish loading.
 * @param ref - The toolbar element
 */
export const useToolbarFit = (ref: RefObject<HTMLElement | null>) => {
  useLayoutEffect(() => {
    const toolbar = ref.current;
    if (!toolbar) return;
    let disposed = false;

    const update = () => {
      if (disposed) return;
      const current = toolbar.dataset.fit as ToolbarFit | undefined;
      const next = chooseFit(
        toolbar.getBoundingClientRect().width,
        measureNeeds(toolbar),
        current,
      );
      if (next !== current) toolbar.dataset.fit = next;
    };
    update();

    // Its width (window, zoom) and its height (a row more or less)
    const resizes =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(update)
        : undefined;
    resizes?.observe(toolbar);
    // Its labels: the run type's name, a key toggle's wording...
    const edits = new MutationObserver(update);
    edits.observe(toolbar, {
      characterData: true,
      childList: true,
      subtree: true,
    });
    // System fonts are there at once; a web font may come later
    const fonts = document.fonts;
    fonts?.addEventListener?.("loadingdone", update);
    void fonts?.ready?.then(update);

    return () => {
      disposed = true;
      resizes?.disconnect();
      edits.disconnect();
      fonts?.removeEventListener?.("loadingdone", update);
    };
  }, [ref]);
};
