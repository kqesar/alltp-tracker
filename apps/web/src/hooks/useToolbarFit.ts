import { type RefObject, useLayoutEffect } from "react";

/**
 * The forms of the toolbar, richest first: what each folds away, and how
 * many rows it may take. Past the full bar, the actions a player uses least
 * during a run fold first:
 *
 * - `labels`: every action with its label, on one row.
 * - `secondary-icons`: Export, Import, Share, Stream view and Shortcuts show
 *   as icons while the primary controls (Mode, New game, Autotracking, the
 *   map layout, the key cells toggle) keep their labels. A button added to
 *   the bar later costs this step its few pixels, never every label at once.
 * - `icons`: every action as an icon, on one row.
 * - `more`: Export, Import, Stream view and Shortcuts move into More.
 * - `more-map`: the map layout too, set once per device and the widest
 *   control left.
 * - `more-keys`: the key cells toggle too, which the run type mostly sets.
 * - `compact`: New game shows as an icon; Mode keeps the run type's name,
 *   and Undo and Redo, used all run long, never fold.
 * - `more-autotrack`: last of all, the Autotracking control, whose dot is
 *   the run's live status and whose race-legal badge a race wants in view:
 *   it stays in the bar while anything else can give way, and in More, the
 *   More button carries its dot.
 */
export const FITS = [
  { fit: "labels", fold: [], rows: 1 },
  { fit: "secondary-icons", fold: ["secondary-labels"], rows: 1 },
  { fit: "icons", fold: ["labels"], rows: 1 },
  { fit: "more", fold: ["labels", "secondary"], rows: 2 },
  { fit: "more-map", fold: ["labels", "secondary", "map"], rows: 2 },
  { fit: "more-keys", fold: ["labels", "secondary", "map", "keys"], rows: 2 },
  {
    fit: "compact",
    fold: ["labels", "secondary", "map", "keys", "new-game"],
    rows: 2,
  },
  {
    fit: "more-autotrack",
    fold: ["labels", "secondary", "map", "keys", "new-game", "autotrack"],
    rows: 2,
  },
] as const;

export type ToolbarFit = (typeof FITS)[number]["fit"];

/** What the toolbar can fold away, as `data-fold` tokens. */
export type ToolbarFold = (typeof FITS)[number]["fold"][number];

/** A form of the bar as laid out: its controls' widths, gap and padding. */
export type FitLayout = { widths: number[]; gap: number; padding: number };

/**
 * Room a richer form needs beyond its own before the bar switches to it.
 * More than a classic scrollbar (15 to 17 px): one appearing as the bar
 * grows or shrinks by a row cannot then flip the bar back.
 */
export const HYSTERESIS_PX = 24;

/**
 * How many rows a form takes in a bar of `width`, its controls broken into
 * lines one after another, as flex-wrap does.
 */
export const rowsAt = ({ widths, gap, padding }: FitLayout, width: number) => {
  const inner = width - padding;
  let rows = 1;
  let line = -1;
  for (const item of widths) {
    if (line < 0) line = item;
    // Half a pixel of slack for sub-pixel widths
    else if (line + gap + item <= inner + 0.5) line += gap + item;
    else {
      rows++;
      line = item;
    }
  }
  return rows;
};

/**
 * The richest form that fits in its rows. Falling back happens as soon as a
 * form no longer fits; moving up needs HYSTERESIS_PX to spare, so a width at
 * the edge does not make the bar switch back and forth. The last form is
 * taken when nothing fits.
 * @param width - The toolbar's width
 * @param layoutOf - Lays a form out, asked for each form in turn until one fits
 * @param current - The form shown now, if any
 */
export const chooseFit = (
  width: number,
  layoutOf: (fit: ToolbarFit) => FitLayout,
  current?: ToolbarFit,
): ToolbarFit => {
  const shown = FITS.findIndex((form) => form.fit === current);
  for (const [index, form] of FITS.entries()) {
    const room = shown >= 0 && index < shown ? width - HYSTERESIS_PX : width;
    if (rowsAt(layoutOf(form.fit), room) <= form.rows) return form.fit;
  }
  return FITS[FITS.length - 1].fit;
};

/** The flex items of a container, through `display: contents` wrappers. */
const flexItems = (container: Element): Element[] =>
  [...container.children].flatMap((child) => {
    const style = getComputedStyle(child);
    if (style.display === "contents") return flexItems(child);
    if (style.display === "none") return [];
    if (style.position === "absolute" || style.position === "fixed") return [];
    return [child];
  });

/**
 * A hidden copy of the toolbar to lay each form out in, whatever the fonts,
 * zoom or labels: on one row at its content's width, in a zero-size, clipped,
 * invisible stage, so it never shows nor widens the page. The status line is
 * left out: it is no action, and may wrap under them.
 * @param toolbar - The toolbar element
 * @returns Lays a form out; then `dispose` removes the copy
 */
export const probeToolbar = (toolbar: HTMLElement) => {
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

  return {
    dispose: () => stage.remove(),
    layoutOf: (fit: ToolbarFit): FitLayout => {
      const form = FITS.find((entry) => entry.fit === fit) ?? FITS[0];
      probe.dataset.fit = fit;
      probe.dataset.fold = form.fold.join(" ");
      const style = getComputedStyle(probe);
      return {
        gap: Number.parseFloat(style.columnGap) || 0,
        padding:
          (Number.parseFloat(style.paddingLeft) || 0) +
          (Number.parseFloat(style.paddingRight) || 0),
        widths: flexItems(probe).map(
          (item) => item.getBoundingClientRect().width,
        ),
      };
    },
  };
};

/**
 * Fold the toolbar to the richest form that fits (a Priority+ toolbar),
 * from the widths it really needs rather than a breakpoint: system fonts
 * differ between macOS, Windows and Linux, and so do zoom, the user's font
 * size and, later, translations. The form goes to the toolbar's `data-fit`
 * and what it folds to `data-fold`, which its CSS follows, so resizing never
 * re-renders React. It is decided before paint, again whenever the toolbar
 * resizes, its content changes or fonts finish loading.
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
      const probe = probeToolbar(toolbar);
      const next = chooseFit(
        toolbar.getBoundingClientRect().width,
        probe.layoutOf,
        current,
      );
      probe.dispose();
      if (next === current) return;
      toolbar.dataset.fold =
        FITS.find((form) => form.fit === next)?.fold.join(" ") ?? "";
      toolbar.dataset.fit = next;
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
