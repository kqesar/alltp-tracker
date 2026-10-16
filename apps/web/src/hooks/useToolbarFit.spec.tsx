import { act, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  chooseFit,
  HYSTERESIS_PX,
  measureNeeds,
  useToolbarFit,
} from "@/hooks/useToolbarFit";

const NEEDS = { icons: 700, labels: 1200 };

describe("chooseFit", () => {
  it.each([
    [1300, "labels"],
    [1200, "labels"],
    [1199, "icons"],
    [700, "icons"],
    [699, "more"],
    [0, "more"],
  ] as const)("at %i px with nothing shown yet, picks %s", (width, fit) => {
    expect(chooseFit(width, NEEDS)).toBe(fit);
  });

  it("keeps a form while it fits, and falls back as soon as it no longer does", () => {
    expect(chooseFit(1200, NEEDS, "labels")).toBe("labels");
    expect(chooseFit(700, NEEDS, "icons")).toBe("icons");
    expect(chooseFit(1199, NEEDS, "labels")).toBe("icons");
    expect(chooseFit(699, NEEDS, "icons")).toBe("more");
    expect(chooseFit(600, NEEDS, "labels")).toBe("more");
  });

  it("moves up only with room to spare, so an edge width cannot flip it", () => {
    expect(chooseFit(700 + HYSTERESIS_PX - 1, NEEDS, "more")).toBe("more");
    expect(chooseFit(700 + HYSTERESIS_PX, NEEDS, "more")).toBe("icons");
    expect(chooseFit(1200 + HYSTERESIS_PX - 1, NEEDS, "icons")).toBe("icons");
    expect(chooseFit(1200 + HYSTERESIS_PX, NEEDS, "icons")).toBe("labels");
    // Without the margin, a scrollbar's width could undo each switch
    expect(HYSTERESIS_PX).toBeGreaterThan(17);
  });
});

/** The width layout would give each element, by its role in the test. */
let available = 2000;
let needs = { ...NEEDS };
const measured: { fit: string; status: boolean; toolbars: number }[] = [];

beforeEach(() => {
  available = 2000;
  needs = { ...NEEDS };
  measured.length = 0;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      // The hidden copy is laid out at its content's width
      if (this.style.width === "max-content") {
        const fit = this.dataset.fit as keyof typeof NEEDS;
        measured.push({
          fit,
          status: Boolean(this.querySelector(".tracker-controls__status")),
          toolbars: document.querySelectorAll('[data-testid="toolbar"]').length,
        });
        return { width: needs[fit] } as DOMRect;
      }
      return { width: available } as DOMRect;
    },
  );
});

afterEach(() => vi.restoreAllMocks());

const Bar = () => (
  <div className="toolbar" data-fit="icons" data-testid="toolbar">
    <button id="mode" type="button">
      Open
    </button>
    <output className="tracker-controls__status">Save imported.</output>
  </div>
);

describe("measureNeeds", () => {
  it("lays a hidden copy out in each full form, without the status line", () => {
    render(<Bar />);

    const result = measureNeeds(screen.getByTestId("toolbar"));

    expect(result).toEqual(NEEDS);
    expect(measured).toEqual([
      { fit: "labels", status: false, toolbars: 1 },
      { fit: "icons", status: false, toolbars: 1 },
    ]);
    // The copy is gone, and the toolbar left as it was
    expect(document.body.children).toHaveLength(1);
    expect(screen.getByTestId("toolbar")).toHaveAttribute("data-fit", "icons");
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

  const Toolbar = ({ label = "Open" }: { label?: string }) => {
    renders++;
    const ref = useRef<HTMLDivElement>(null);
    useToolbarFit(ref);
    return (
      <div className="toolbar" data-testid="toolbar" ref={ref}>
        <button type="button">{label}</button>
      </div>
    );
  };
  const fit = () => screen.getByTestId("toolbar").dataset.fit;
  /** Resize the toolbar: the observers watching it are told. */
  const resizeTo = (width: number) => {
    available = width;
    const toolbar = screen.getByTestId("toolbar");
    act(() => {
      for (const { callback, targets } of observers) {
        if (targets.includes(toolbar)) callback();
      }
    });
  };

  it("picks the richest form that fits, before paint", () => {
    render(<Toolbar />);

    expect(fit()).toBe("labels");
  });

  it("follows resizes, with a margin before moving up, and no re-render", () => {
    render(<Toolbar />);
    const rendered = renders;

    resizeTo(1000);
    expect(fit()).toBe("icons");
    resizeTo(500);
    expect(fit()).toBe("more");
    resizeTo(710);
    expect(fit()).toBe("more");
    resizeTo(730);
    expect(fit()).toBe("icons");
    expect(renders).toBe(rendered);
  });

  it("measures again when the toolbar's content changes", async () => {
    available = 1000;
    const { rerender } = render(<Toolbar />);
    expect(fit()).toBe("icons");

    needs = { icons: 1100, labels: 1500 };
    rerender(<Toolbar label="Keysanity" />);
    // The mutation observer runs once React has written the new label
    await act(() => Promise.resolve());

    expect(fit()).toBe("more");
  });

  it("stops watching once unmounted", () => {
    const { unmount } = render(<Toolbar />);

    unmount();

    expect(disconnect).toHaveBeenCalled();
  });
});
