import { fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HelpOverlay } from "./HelpOverlay";

describe("HelpOverlay", () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  it("does not render when not visible", () => {
    render(<HelpOverlay isVisible={false} onClose={mockOnClose} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders when visible", () => {
    render(<HelpOverlay isVisible={true} onClose={mockOnClose} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByText("ALttP Randomizer Tracker Help"),
    ).toBeInTheDocument();
  });

  it("displays keyboard shortcuts tab by default", () => {
    render(<HelpOverlay isVisible={true} onClose={mockOnClose} />);

    expect(
      screen.getByRole("button", { name: "Keyboard Shortcuts" }),
    ).toHaveClass("help-overlay__tab--active");
    expect(screen.getByText("Navigation")).toBeInTheDocument();
    expect(
      screen.getByText("Navigate through items in the grid"),
    ).toBeInTheDocument();
  });

  it("switches to gameplay tips tab when clicked", async () => {
    const user = userEvent.setup();

    render(<HelpOverlay isVisible={true} onClose={mockOnClose} />);

    const gameplayTipsTab = screen.getByRole("button", {
      name: "Gameplay Tips",
    });
    await user.click(gameplayTipsTab);

    expect(screen.getByText("Progression Strategy")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Always get the Moon Pearl before extensive Dark World exploration",
      ),
    ).toBeInTheDocument();
  });

  it("closes when close button is clicked", async () => {
    const user = userEvent.setup();

    render(<HelpOverlay isVisible={true} onClose={mockOnClose} />);

    const closeButton = screen.getByRole("button", { name: "Close help" });
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it("closes when close help button is clicked", async () => {
    const user = userEvent.setup();

    render(<HelpOverlay isVisible={true} onClose={mockOnClose} />);

    const closeHelpButton = screen.getByRole("button", { name: "Close Help" });
    await user.click(closeHelpButton);

    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it("closes when backdrop is clicked", async () => {
    const user = userEvent.setup();

    render(<HelpOverlay isVisible={true} onClose={mockOnClose} />);

    const backdrop = screen.getByRole("dialog");
    await user.click(backdrop);

    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it("does not close when clicking inside content", async () => {
    const user = userEvent.setup();

    render(<HelpOverlay isVisible={true} onClose={mockOnClose} />);

    const content = screen.getByText("ALttP Randomizer Tracker Help");
    await user.click(content);

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it("closes on escape key", () => {
    render(<HelpOverlay isVisible={true} onClose={mockOnClose} />);

    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it("does not close on other keys", () => {
    render(<HelpOverlay isVisible={true} onClose={mockOnClose} />);

    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Enter" });

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it("displays all keyboard shortcut sections", () => {
    render(<HelpOverlay isVisible={true} onClose={mockOnClose} />);

    expect(screen.getByText("Navigation")).toBeInTheDocument();
    expect(screen.getByText("Item Actions")).toBeInTheDocument();
    expect(screen.getByText("Save Management")).toBeInTheDocument();
  });

  it("displays keyboard shortcut keys and descriptions", () => {
    render(<HelpOverlay isVisible={true} onClose={mockOnClose} />);

    // Check for specific keys (using getAllByText for duplicates)
    expect(screen.getByText("←")).toBeInTheDocument();
    expect(screen.getByText("→")).toBeInTheDocument();
    expect(screen.getByText("↑")).toBeInTheDocument();
    expect(screen.getByText("↓")).toBeInTheDocument();
    expect(screen.getAllByText("Tab")).toHaveLength(2); // Tab appears twice (Tab and Shift+Tab)
    expect(screen.getByText("Space")).toBeInTheDocument();
    expect(screen.getByText("Enter")).toBeInTheDocument();

    // Check for descriptions
    expect(
      screen.getByText("Navigate through items in the grid"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Toggle item state")).toHaveLength(2); // Space and Enter both toggle
  });

  it("displays all gameplay tip sections when on tips tab", async () => {
    const user = userEvent.setup();

    render(<HelpOverlay isVisible={true} onClose={mockOnClose} />);

    const gameplayTipsTab = screen.getByRole("button", {
      name: "Gameplay Tips",
    });
    await user.click(gameplayTipsTab);

    expect(screen.getByText("Progression Strategy")).toBeInTheDocument();
    expect(screen.getByText("Item Tracking")).toBeInTheDocument();
    expect(screen.getByText("Randomizer Specific")).toBeInTheDocument();
  });

  it("displays gameplay tips content", async () => {
    const user = userEvent.setup();

    render(<HelpOverlay isVisible={true} onClose={mockOnClose} />);

    const gameplayTipsTab = screen.getByRole("button", {
      name: "Gameplay Tips",
    });
    await user.click(gameplayTipsTab);

    expect(
      screen.getByText(
        "Always get the Moon Pearl before extensive Dark World exploration",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Click items to cycle through their states (0-4 for progressive items)",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Logic may require unexpected item combinations"),
    ).toBeInTheDocument();
  });

  it("highlights active tab", async () => {
    const user = userEvent.setup();

    render(<HelpOverlay isVisible={true} onClose={mockOnClose} />);

    const shortcutsTab = screen.getByRole("button", {
      name: "Keyboard Shortcuts",
    });
    const gameplayTipsTab = screen.getByRole("button", {
      name: "Gameplay Tips",
    });

    // Initially shortcuts tab should be active
    expect(shortcutsTab).toHaveClass("help-overlay__tab--active");
    expect(gameplayTipsTab).not.toHaveClass("help-overlay__tab--active");

    // Switch to gameplay tips
    await user.click(gameplayTipsTab);

    expect(shortcutsTab).not.toHaveClass("help-overlay__tab--active");
    expect(gameplayTipsTab).toHaveClass("help-overlay__tab--active");
  });

  it("has proper accessibility attributes", () => {
    render(<HelpOverlay isVisible={true} onClose={mockOnClose} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "help-title");
    expect(dialog).toHaveAttribute("tabIndex", "-1");

    expect(
      screen.getByRole("heading", { name: "ALttP Randomizer Tracker Help" }),
    ).toHaveAttribute("id", "help-title");
  });

  it("displays footer information", () => {
    render(<HelpOverlay isVisible={true} onClose={mockOnClose} />);

    expect(
      screen.getByText(
        /This tracker helps you keep track of items and progress/,
      ),
    ).toBeInTheDocument();
  });
});
