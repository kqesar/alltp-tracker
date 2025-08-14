import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BigKey } from "@/components/tracker/items/BigKey";

// Mock getAssetPath
vi.mock("@/utils", () => ({
  getAssetPath: vi.fn((path: string) => `/mocked/path/${path}`),
}));

// Mock useGameStore
const mockHandleItemClick = vi.fn();

vi.mock("@/stores/gameStore", () => ({
  useGameStore: vi.fn(() => ({
    handleItemClick: mockHandleItemClick,
    items: {
      bigkey0: 0, // not obtained
      bigkey1: 1, // obtained
      bigkey2: 0, // not obtained
      bigkey3: 1, // obtained
    },
  })),
}));

describe("BigKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with correct properties for not obtained big key", () => {
    render(<BigKey col={5} dungeonIndex={0} row={2} />);

    const bigKeyOverlay = document.querySelector(".big-key-overlay");
    expect(bigKeyOverlay).toBeInTheDocument();
    expect(bigKeyOverlay).toHaveAttribute("data-dungeon", "0");
    expect(bigKeyOverlay).toHaveAttribute("data-grid-col", "5");
    expect(bigKeyOverlay).toHaveAttribute("data-grid-row", "2");
    expect(bigKeyOverlay).not.toHaveClass("big-key-overlay--obtained");
  });

  it("renders with obtained styling when big key is obtained", () => {
    render(<BigKey col={5} dungeonIndex={1} row={2} />);

    const bigKeyOverlay = document.querySelector(".big-key-overlay");
    expect(bigKeyOverlay).toHaveClass("big-key-overlay--obtained");
  });

  it("has correct aria-label and title for not obtained key", () => {
    render(<BigKey col={5} dungeonIndex={0} row={2} />);

    const bigKeyOverlay = document.querySelector(".big-key-overlay");
    expect(bigKeyOverlay).toHaveAttribute(
      "aria-label",
      "Big key for dungeon 0: not obtained",
    );
    expect(bigKeyOverlay).toHaveAttribute(
      "title",
      "Big key for dungeon 0: not obtained",
    );
  });

  it("has correct aria-label and title for obtained key", () => {
    render(<BigKey col={5} dungeonIndex={1} row={2} />);

    const bigKeyOverlay = document.querySelector(".big-key-overlay");
    expect(bigKeyOverlay).toHaveAttribute(
      "aria-label",
      "Big key for dungeon 1: obtained",
    );
    expect(bigKeyOverlay).toHaveAttribute(
      "title",
      "Big key for dungeon 1: obtained",
    );
  });

  it("calls handleItemClick when clicked", () => {
    render(<BigKey col={5} dungeonIndex={2} row={3} />);

    const bigKeyOverlay = document.querySelector(".big-key-overlay");
    expect(bigKeyOverlay).toBeInTheDocument();

    if (bigKeyOverlay) {
      fireEvent.click(bigKeyOverlay);
    }
    expect(mockHandleItemClick).toHaveBeenCalledWith("bigkey2");
  });

  it("stops propagation and prevents default on click", () => {
    render(<BigKey col={5} dungeonIndex={2} row={3} />);

    const bigKeyOverlay = document.querySelector(".big-key-overlay");
    const clickEvent = new MouseEvent("click", { bubbles: true });
    const preventDefaultSpy = vi.spyOn(clickEvent, "preventDefault");
    const stopPropagationSpy = vi.spyOn(clickEvent, "stopPropagation");

    if (bigKeyOverlay) {
      fireEvent(bigKeyOverlay, clickEvent);
    }

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(stopPropagationSpy).toHaveBeenCalled();
  });

  it("responds to keyboard events (Enter and Space)", () => {
    render(<BigKey col={5} dungeonIndex={2} row={3} />);

    const bigKeyOverlay = document.querySelector(".big-key-overlay");
    expect(bigKeyOverlay).toBeInTheDocument();

    // Test Enter key
    if (bigKeyOverlay) {
      fireEvent.keyDown(bigKeyOverlay, { key: "Enter" });
    }
    expect(mockHandleItemClick).toHaveBeenCalledWith("bigkey2");

    // Clear mock and test Space key
    mockHandleItemClick.mockClear();
    if (bigKeyOverlay) {
      fireEvent.keyDown(bigKeyOverlay, { key: " " });
    }
    expect(mockHandleItemClick).toHaveBeenCalledWith("bigkey2");
  });

  it("renders with correct background image", () => {
    render(<BigKey col={5} dungeonIndex={0} row={2} />);

    const icon = document.querySelector(".big-key-icon");
    expect(icon).toHaveStyle({
      backgroundImage: "url(/mocked/path/bigkey.png)",
    });
  });

  it("has correct CSS classes", () => {
    render(<BigKey col={5} dungeonIndex={0} row={2} />);

    const bigKeyOverlay = document.querySelector(".big-key-overlay");
    expect(bigKeyOverlay).toHaveClass("overlay-base");
    expect(bigKeyOverlay).toHaveClass("big-key-overlay");
  });

  it("handles different dungeon indices correctly", () => {
    const { rerender } = render(<BigKey col={5} dungeonIndex={3} row={2} />);

    let bigKeyOverlay = document.querySelector(".big-key-overlay");
    expect(bigKeyOverlay).toHaveClass("big-key-overlay--obtained"); // bigkey3 is obtained

    rerender(<BigKey col={5} dungeonIndex={2} row={2} />);
    bigKeyOverlay = document.querySelector(".big-key-overlay");
    expect(bigKeyOverlay).not.toHaveClass("big-key-overlay--obtained"); // bigkey2 is not obtained
  });

  it("has proper accessibility attributes", () => {
    render(<BigKey col={5} dungeonIndex={0} row={2} />);

    const bigKeyOverlay = document.querySelector(".big-key-overlay");
    expect(bigKeyOverlay).toBeInstanceOf(HTMLButtonElement);
    expect(bigKeyOverlay).toHaveAttribute("tabIndex", "0");
  });
});
