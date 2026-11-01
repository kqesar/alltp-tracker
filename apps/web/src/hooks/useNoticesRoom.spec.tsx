import { render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NOTICES_ROOM, useNoticesRoom } from "@/hooks/useNoticesRoom";

/** The notices' container, measured `top` px down a 900 px tall viewport. */
const Notices = () => {
  const ref = useRef<HTMLDivElement>(null);
  useNoticesRoom(ref);
  return <div data-testid="notices" ref={ref} />;
};

const room = () =>
  document.documentElement.style.getPropertyValue(NOTICES_ROOM);

afterEach(() => vi.restoreAllMocks());

describe("useNoticesRoom", () => {
  it("keeps the notices' room at the page's end, and none once they are empty or gone", () => {
    vi.stubGlobal("innerHeight", 900);
    const box = { height: 150, top: 734 };
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      () => box as DOMRect,
    );
    const { unmount } = render(<Notices />);
    // 150 px of notices and the 16 px gap under them
    expect(room()).toBe("166px");

    box.height = 0;
    box.top = 900;
    window.dispatchEvent(new Event("resize"));
    expect(room()).toBe("0px");

    unmount();
    expect(room()).toBe("");
    vi.unstubAllGlobals();
  });
});
