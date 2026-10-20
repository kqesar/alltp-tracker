import { act, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  chooseFit,
  type FitLayout,
  HYSTERESIS_PX,
  probeToolbar,
  rowsAt,
  type ToolbarFit,
  useToolbarFit,
} from "@/hooks/useToolbarFit";

describe("rowsAt", () => {
  const layout = { gap: 10, padding: 20, widths: [100, 100, 100] };

  it("breaks the controls into rows one after another, as flex-wrap does", () => {
    expect(rowsAt(layout, 340)).toBe(1);
    expect(rowsAt(layout, 339)).toBe(2);
    expect(rowsAt(layout, 230)).toBe(2);
    expect(rowsAt(layout, 229)).toBe(3);
  });

  it("keeps a control wider than the bar on a row of its own", () => {
    expect(rowsAt({ gap: 10, padding: 0, widths: [500, 50] }, 100)).toBe(2);
  });
});

/** Each form laid out: a richer form has wider or more controls. */
const LAYOUTS: Record<ToolbarFit, FitLayout> = {
  compact: { gap: 0, padding: 0, widths: [60, 60, 60, 60] },
  icons: { gap: 8, padding: 0, widths: [300, 300] },
  labels: { gap: 8, padding: 0, widths: [500, 500] },
  more: { gap: 8, padding: 0, widths: [200, 200, 200] },
  "more-autotrack": { gap: 0, padding: 0, widths: [50, 50, 50] },
  "more-keys": { gap: 0, padding: 0, widths: [100, 100, 100, 100] },
  "more-map": { gap: 8, padding: 0, widths: [150, 150, 150] },
  "secondary-icons": { gap: 8, padding: 0, widths: [400, 400] },
};
const layoutOf = (fit: ToolbarFit) => LAYOUTS[fit];

describe("chooseFit", () => {
  it.each([
    [1100, "labels"],
    [1008, "labels"],
    [1007, "secondary-icons"],
    [808, "secondary-icons"],
    [807, "icons"],
    [608, "icons"],
    [607, "more"],
    [408, "more"],
    [407, "more-map"],
    [308, "more-map"],
    [307, "more-keys"],
    [200, "more-keys"],
    [199, "compact"],
    [120, "compact"],
    [119, "more-autotrack"],
    [75, "more-autotrack"],
    // Nothing fits: the last form, the narrowest
    [50, "more-autotrack"],
  ] as const)("at %i px with nothing shown yet, picks %s", (width, fit) => {
    expect(chooseFit(width, layoutOf)).toBe(fit);
  });

  it("needs one row for the full bar, two once it folds into More", () => {
    // The icons on two rows would fit at 400 px: the bar folds instead
    expect(rowsAt(LAYOUTS.icons, 400)).toBe(2);
    expect(chooseFit(400, layoutOf)).not.toBe("icons");
  });

  it("lays out only the forms it has to, richest first", () => {
    const asked = vi.fn(layoutOf);

    chooseFit(700, asked);

    expect(asked.mock.calls.map(([fit]) => fit)).toEqual([
      "labels",
      "secondary-icons",
      "icons",
    ]);
  });

  it("keeps a form while it fits, and falls back as soon as it no longer does", () => {
    expect(chooseFit(1008, layoutOf, "labels")).toBe("labels");
    expect(chooseFit(408, layoutOf, "more")).toBe("more");
    expect(chooseFit(1007, layoutOf, "labels")).toBe("secondary-icons");
    expect(chooseFit(807, layoutOf, "secondary-icons")).toBe("icons");
    expect(chooseFit(407, layoutOf, "more")).toBe("more-map");
    expect(chooseFit(250, layoutOf, "labels")).toBe("more-keys");
  });

  it("moves up only with room to spare, so an edge width cannot flip it", () => {
    expect(chooseFit(408 + HYSTERESIS_PX - 1, layoutOf, "more-map")).toBe(
      "more-map",
    );
    expect(chooseFit(408 + HYSTERESIS_PX, layoutOf, "more-map")).toBe("more");
    expect(
      chooseFit(1008 + HYSTERESIS_PX - 1, layoutOf, "secondary-icons"),
    ).toBe("secondary-icons");
    expect(chooseFit(1008 + HYSTERESIS_PX, layoutOf, "secondary-icons")).toBe(
      "labels",
    );
    expect(chooseFit(808 + HYSTERESIS_PX - 1, layoutOf, "icons")).toBe("icons");
    expect(chooseFit(808 + HYSTERESIS_PX, layoutOf, "icons")).toBe(
      "secondary-icons",
    );
    // Without the margin, a scrollbar's width could undo each switch
    expect(HYSTERESIS_PX).toBeGreaterThan(17);
  });
});

/** The live toolbar's width, as layout would give it. */
let available = 2000;
/** Each control's width in the hidden copy, by the form it is laid out in. */
let controlWidth: Record<ToolbarFit, number>;
const seen: { fold: string; toolbars: number }[] = [];

beforeEach(() => {
  available = 2000;
  controlWidth = {
    compact: 60,
    icons: 200,
    labels: 400,
    more: 150,
    "more-autotrack": 40,
    "more-keys": 80,
    "more-map": 100,
    "secondary-icons": 300,
  };
  seen.length = 0;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      if (this.dataset.testid === "toolbar") {
        return { width: available } as DOMRect;
      }
      const probe = this.closest<HTMLElement>("[data-fit]");
      const fit = (probe?.dataset.fit ?? "labels") as ToolbarFit;
      seen.push({
        fold: probe?.dataset.fold ?? "",
        toolbars: document.querySelectorAll('[data-testid="toolbar"]').length,
      });
      return { width: Number(this.dataset.w ?? controlWidth[fit]) } as DOMRect;
    },
  );
});

afterEach(() => vi.restoreAllMocks());

describe("probeToolbar", () => {
  it("lays a hidden copy out: its controls through wrappers, without the status line", () => {
    render(
      <div
        className="toolbar"
        data-testid="toolbar"
        style={{ columnGap: "8px", paddingLeft: "4px", paddingRight: "6px" }}
      >
        <button data-w="70" id="mode" type="button">
          Open
        </button>
        <span style={{ display: "contents" }}>
          <button data-w="40" type="button">
            Export
          </button>
        </span>
        <span style={{ display: "none" }}>
          <button data-w="999" type="button">
            Hidden
          </button>
        </span>
        <input aria-label="File" style={{ position: "absolute" }} type="file" />
        <output className="tracker-controls__status" data-w="999">
          Save imported.
        </output>
      </div>,
    );
    const probe = probeToolbar(screen.getByTestId("toolbar"));

    const layout = probe.layoutOf("more-map");
    probe.dispose();

    expect(layout).toEqual({ gap: 8, padding: 10, widths: [70, 40] });
    // Laid out folded as the form says, with no second toolbar to find
    expect(seen).toEqual([
      { fold: "labels secondary map", toolbars: 1 },
      { fold: "labels secondary map", toolbars: 1 },
    ]);
    expect(document.body.children).toHaveLength(1);
  });
});

describe("useToolbarFit", () => {
  /** The ResizeObservers made, with what each watches. */
  const observers: { callback: () => void; targets: Element[] }[] = [];
  const disconnect = vi.fn();
  let renders = 0;

  beforeEach(() => {
    observers.length = 0;
    renders = 0;
    disconnect.mockClear();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        targets: Element[] = [];
        constructor(callback: () => void) {
          observers.push({ callback, targets: this.targets });
        }
        observe(target: Element) {
          this.targets.push(target);
        }
        disconnect = disconnect;
      },
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  /** Three controls, no gap or padding: their width decides the rows. */
  const Toolbar = ({ label = "Open" }: { label?: string }) => {
    renders++;
    const ref = useRef<HTMLDivElement>(null);
    useToolbarFit(ref);
    return (
      <div className="toolbar" data-testid="toolbar" ref={ref}>
        <button type="button">{label}</button>
        <button type="button">Undo</button>
        <button type="button">Redo</button>
      </div>
    );
  };
  const toolbar = () => screen.getByTestId("toolbar");
  /** Resize the toolbar: the observers watching it are told. */
  const resizeTo = (width: number) => {
    available = width;
    act(() => {
      for (const { callback, targets } of observers) {
        if (targets.includes(toolbar())) callback();
      }
    });
  };

  it("picks the richest form that fits, before paint", () => {
    render(<Toolbar />);

    expect(toolbar()).toHaveAttribute("data-fit", "labels");
    expect(toolbar()).toHaveAttribute("data-fold", "");
  });

  it("folds step by step down to the narrowest bar, writing what it folds", () => {
    render(<Toolbar />);
    const folds: Record<number, [string?, string?]> = {};

    for (const width of [900, 700, 400, 250, 170, 130, 100]) {
      resizeTo(width);
      folds[width] = [toolbar().dataset.fit, toolbar().dataset.fold];
    }

    expect(folds).toEqual({
      100: ["more-autotrack", "labels secondary map keys new-game autotrack"],
      130: ["compact", "labels secondary map keys new-game"],
      170: ["more-keys", "labels secondary map keys"],
      250: ["more-map", "labels secondary map"],
      400: ["more", "labels secondary"],
      700: ["icons", "labels"],
      900: ["secondary-icons", "secondary-labels"],
    });
  });

  it("moves back up with a margin, and never re-renders React", () => {
    render(<Toolbar />);
    const rendered = renders;

    resizeTo(250);
    expect(toolbar().dataset.fit).toBe("more-map");
    resizeTo(300 + HYSTERESIS_PX - 1);
    expect(toolbar().dataset.fit).toBe("more-map");
    resizeTo(300 + HYSTERESIS_PX);
    expect(toolbar().dataset.fit).toBe("more");
    expect(renders).toBe(rendered);
  });

  it("measures again when the toolbar's content changes", async () => {
    available = 700;
    const { rerender } = render(<Toolbar />);
    expect(toolbar().dataset.fit).toBe("icons");

    controlWidth = { ...controlWidth, icons: 300 };
    rerender(<Toolbar label="Keysanity" />);
    // The mutation observer runs once React has written the new label
    await act(() => Promise.resolve());

    expect(toolbar().dataset.fit).toBe("more");
  });

  it("stops watching once unmounted", () => {
    const { unmount } = render(<Toolbar />);

    unmount();

    expect(disconnect).toHaveBeenCalled();
  });
});
