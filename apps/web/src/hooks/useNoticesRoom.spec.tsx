import { render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NOTICES_PAD,
  NOTICES_ROOM,
  useNoticesRoom,
} from "@/hooks/useNoticesRoom";

/** The notices and the board, as GameShell holds them. */
const Page = () => {
  const notices = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLElement>(null);
  useNoticesRoom(notices, main);
  return (
    <>
      <div data-testid="notices" ref={notices} />
      <main data-testid="main" ref={main} />
    </>
  );
};

const style = (name: string) =>
  document.documentElement.style.getPropertyValue(name);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useNoticesRoom", () => {
  /** A 900 px tall viewport, the notices 150 px tall above a 16 px gap. */
  const measured = (main: { bottom: number }) => {
    vi.stubGlobal("innerHeight", 900);
    const notices = { height: 150, top: 734 };
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        return (this.dataset.testid === "main" ? main : notices) as DOMRect;
      },
    );
    return notices;
  };

  it("keeps the notices' room for focus, and pads the page only where they would cover the board", () => {
    const main = { bottom: 500 };
    const notices = measured(main);
    const { unmount } = render(<Page />);
    // The board ends above them: no scroll is added
    expect(style(NOTICES_ROOM)).toBe("166px");
    expect(style(NOTICES_PAD)).toBe("0px");

    // Its last 66 px would be under them: just those
    main.bottom = 800;
    window.dispatchEvent(new Event("resize"));
    expect(style(NOTICES_PAD)).toBe("66px");

    // A page that scrolls already: all their room
    main.bottom = 1600;
    window.dispatchEvent(new Event("resize"));
    expect(style(NOTICES_PAD)).toBe("166px");

    // No notice: no room
    notices.height = 0;
    notices.top = 900;
    window.dispatchEvent(new Event("resize"));
    expect(style(NOTICES_ROOM)).toBe("0px");
    expect(style(NOTICES_PAD)).toBe("0px");

    unmount();
    expect(style(NOTICES_ROOM)).toBe("");
    expect(style(NOTICES_PAD)).toBe("");
  });
});
