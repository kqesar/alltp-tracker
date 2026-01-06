import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BigKeyToggle } from "./BigKeyToggle";

// Mock the gameStore
const mockResetItemLayout = vi.fn();
vi.mock("@/stores/gameStore", () => ({
  useGameStore: (
    selector: (state: { resetItemLayout: () => void }) => unknown,
  ) => selector({ resetItemLayout: mockResetItemLayout }),
}));

describe("BigKeyToggle", () => {
  const mockOnToggle = vi.fn();

  beforeEach(() => {
    mockOnToggle.mockClear();
    mockResetItemLayout.mockClear();
  });

  it("renders with correct visible state", () => {
    render(<BigKeyToggle isVisible={true} onToggle={mockOnToggle} />);

    const button = screen.getByRole("button", { name: "Hide big keys" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass("bigkey-toggle--active");
    expect(screen.getByText("Hide Big Keys")).toBeInTheDocument();
  });

  it("renders with correct hidden state", () => {
    render(<BigKeyToggle isVisible={false} onToggle={mockOnToggle} />);

    const button = screen.getByRole("button", { name: "Show big keys" });
    expect(button).toBeInTheDocument();
    expect(button).not.toHaveClass("bigkey-toggle--active");
    expect(screen.getByText("Show Big Keys")).toBeInTheDocument();
  });

  it("calls onToggle when clicked", async () => {
    const user = userEvent.setup();
    render(<BigKeyToggle isVisible={true} onToggle={mockOnToggle} />);

    const button = screen.getByRole("button", { name: "Hide big keys" });
    await user.click(button);

    expect(mockOnToggle).toHaveBeenCalledWith(false);
    expect(mockOnToggle).toHaveBeenCalledOnce();
  });

  it("toggles from hidden to visible", async () => {
    const user = userEvent.setup();
    render(<BigKeyToggle isVisible={false} onToggle={mockOnToggle} />);

    const button = screen.getByRole("button", { name: "Show big keys" });
    await user.click(button);

    expect(mockOnToggle).toHaveBeenCalledWith(true);
    expect(mockOnToggle).toHaveBeenCalledOnce();
  });

  it("has correct accessibility attributes", () => {
    render(<BigKeyToggle isVisible={true} onToggle={mockOnToggle} />);

    const button = screen.getByRole("button", { name: "Hide big keys" });
    expect(button).toHaveAttribute("aria-label", "Hide big keys");
    expect(button).toHaveAttribute("title", "Hide big keys");
    expect(button).toHaveAttribute("type", "button");
  });

  it("displays key icon", () => {
    render(<BigKeyToggle isVisible={true} onToggle={mockOnToggle} />);

    const button = screen.getByRole("button", { name: "Hide big keys" });
    const icon = button.querySelector(".bigkey-toggle__icon");
    const keyIcon = button.querySelector(".bigkey-toggle__key-icon");

    expect(icon).toBeInTheDocument();
    expect(keyIcon).toBeInTheDocument();
  });

  it("shows slash overlay when hidden", () => {
    render(<BigKeyToggle isVisible={false} onToggle={mockOnToggle} />);

    const button = screen.getByRole("button", { name: "Show big keys" });
    const slash = button.querySelector(".bigkey-toggle__slash");

    expect(slash).toBeInTheDocument();
  });

  it("does not show slash overlay when visible", () => {
    render(<BigKeyToggle isVisible={true} onToggle={mockOnToggle} />);

    const button = screen.getByRole("button", { name: "Hide big keys" });
    const slash = button.querySelector(".bigkey-toggle__slash");

    expect(slash).not.toBeInTheDocument();
  });

  describe("Reset Item Tracker button", () => {
    it("renders Reset Item Tracker button", () => {
      render(<BigKeyToggle isVisible={true} onToggle={mockOnToggle} />);

      const resetButton = screen.getByRole("button", {
        name: /reset item tracker/i,
      });
      expect(resetButton).toBeInTheDocument();
      expect(resetButton).toHaveAttribute("title", "Reset Item Tracker");
    });

    it("calls resetItemLayout when Reset button is clicked", async () => {
      const user = userEvent.setup();
      render(<BigKeyToggle isVisible={true} onToggle={mockOnToggle} />);

      const resetButton = screen.getByRole("button", {
        name: /reset item tracker/i,
      });
      await user.click(resetButton);

      expect(mockResetItemLayout).toHaveBeenCalledTimes(1);
    });

    it("displays reset icon", () => {
      render(<BigKeyToggle isVisible={true} onToggle={mockOnToggle} />);

      const resetButton = screen.getByRole("button", {
        name: /reset item tracker/i,
      });
      const resetIcon = resetButton.querySelector(".bigkey-toggle__reset-icon");

      expect(resetIcon).toBeInTheDocument();
    });
  });
});
