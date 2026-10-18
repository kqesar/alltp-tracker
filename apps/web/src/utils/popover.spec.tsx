import { fireEvent, render, screen } from "@testing-library/react";
import type { MouseEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { placeUnder } from "@/utils/popover";

/** A button at `left`, 100 px wide, in a 1000 px wide window. */
const openAt = (left: number) => {
  vi.spyOn(window, "innerWidth", "get").mockReturnValue(1000);
  render(
    <>
      <button
        data-testid="opener"
        onClick={(event) => placeUnder(event, "panel")}
        type="button"
      >
        Open
      </button>
      <div data-testid="panel" id="panel" />
    </>,
  );
  const opener = screen.getByTestId("opener");
  vi.spyOn(opener, "getBoundingClientRect").mockReturnValue({
    bottom: 60,
    left,
    right: left + 100,
    width: 100,
  } as DOMRect);
  fireEvent.click(opener);
  return screen.getByTestId("panel").style;
};

describe("placeUnder", () => {
  it("hangs a popover from a left-hand button's left edge", () => {
    const style = openAt(200);
    expect(style.top).toBe("64px");
    expect(style.left).toBe("200px");
    expect(style.right).toBe("auto");
  });

  it("hangs it from a right-hand button's right edge", () => {
    const style = openAt(700);
    expect(style.left).toBe("auto");
    expect(style.right).toBe("200px");
  });

  it("keeps it off the window's left edge", () => {
    expect(openAt(0).left).toBe("8px");
  });

  it("keeps it off the window's right edge", () => {
    expect(openAt(950).right).toBe("8px");
  });

  it("does nothing without the popover", () => {
    const click = {
      currentTarget: document.createElement("button"),
    } as unknown as MouseEvent<HTMLButtonElement>;
    expect(() => placeUnder(click, "missing")).not.toThrow();
  });
});
