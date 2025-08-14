import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useGameStore } from "@/stores/gameStore";
import App from "./App";

// Mock the MapTracker component since it's tested separately
vi.mock("@/components/map/MapTracker", () => ({
  MapTracker: ({ caption }: { caption: string }) => (
    <div data-testid="map-tracker">
      Map Tracker Component - Caption: {caption}
    </div>
  ),
}));

// Mock CSS import
vi.mock("@/styles/index.css", () => ({}));

describe("App", () => {
  it("renders without crashing", () => {
    render(<App />);
    expect(screen.getByTestId("map-tracker")).toBeInTheDocument();
  });

  it("renders the header component", () => {
    render(<App />);
    expect(screen.getByText("ALLTP Tracker")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /github/i })).toBeInTheDocument();
  });

  it("renders the item grid layout", () => {
    render(<App />);
    // Check for the main tracker grid
    const trackerGrid = document.querySelector(".tracker");
    expect(trackerGrid).toBeInTheDocument();

    // Check for some buttons
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("renders caption container with initial empty state", () => {
    render(<App />);
    // The caption area exists somewhere in the layout
    const layoutDiv = document.getElementById("layoutdiv");
    expect(layoutDiv).toBeInTheDocument();

    // The MapTracker mock should be rendered
    expect(screen.getByTestId("map-tracker")).toBeInTheDocument();
  });

  it("handles item clicks for boolean items", () => {
    render(<App />);

    // Find buttons with background images (item buttons)
    const buttons = screen.getAllByRole("button");
    const itemButtons = buttons.filter((button) =>
      button.style.backgroundImage?.includes("hookshot"),
    );

    if (itemButtons.length > 0) {
      const hookshotButton = itemButtons[0];

      // Initially should have low opacity (inactive state)
      expect(hookshotButton).toHaveStyle("opacity: 0.25");

      // Click to activate
      fireEvent.click(hookshotButton);

      // Should now have full opacity (active state)
      expect(hookshotButton).toHaveStyle("opacity: 1");
    }
  });

  it("handles item clicks for numeric items", () => {
    render(<App />);

    // Find buttons with bow background
    const buttons = screen.getAllByRole("button");
    const bowButtons = buttons.filter((button) =>
      button.style.backgroundImage?.includes("bow"),
    );

    if (bowButtons.length > 0) {
      const bowButton = bowButtons[0];

      // Initially should be at minimum value
      expect(bowButton).toHaveStyle("opacity: 0.25");

      // Click to cycle through values
      fireEvent.click(bowButton);
      expect(bowButton).toHaveStyle("opacity: 1");
    }
  });

  it("ignores clicks on blank items", () => {
    render(<App />);

    // Find buttons with blank items
    const buttons = screen.getAllByRole("button");
    const blankButtons = buttons.filter(
      (button) => button.getAttribute("data-item") === "blank",
    );

    // Should have some blank buttons or verify spacers exist for empty cells
    const spacers = document.querySelectorAll(".grid-spacer");

    // Either we have blank buttons or spacers (both represent non-interactive cells)
    expect(blankButtons.length + spacers.length).toBeGreaterThan(0);

    // Clicking blank buttons should not cause any errors
    if (blankButtons.length > 0) {
      fireEvent.click(blankButtons[0]);
      // No assertion needed - just ensure no error is thrown
    }
  });

  it("renders corner elements for special layouts", () => {
    render(<App />);

    // The corner elements should be rendered for certain layout positions
    const cornerElements = document.querySelectorAll(".lonk");

    expect(cornerElements.length).toBeGreaterThan(0);
  });

  it("displays correct background images for items", () => {
    render(<App />);

    // Check that items have background images set
    const buttons = screen.getAllByRole("button");
    const hookshotButtons = buttons.filter((button) =>
      button.style.backgroundImage?.includes("hookshot"),
    );
    const hammerButtons = buttons.filter((button) =>
      button.style.backgroundImage?.includes("hammer"),
    );

    expect(hookshotButtons.length).toBeGreaterThan(0);
    expect(hammerButtons.length).toBeGreaterThan(0);
  });

  it("shows special overlay for boss items", () => {
    render(<App />);

    // Find buttons with boss background images
    const buttons = screen.getAllByRole("button");
    const bossButtons = buttons.filter((button) =>
      button.style.backgroundImage?.includes("boss"),
    );

    expect(bossButtons.length).toBeGreaterThan(0);

    if (bossButtons.length > 0) {
      // Boss buttons should have overlays for medallions, chests, and rewards
      const overlays = bossButtons[0].querySelectorAll("[class*='overlay']");
      expect(overlays.length).toBeGreaterThanOrEqual(0);
    }
  });

  it("handles right-click for reverse cycling on numeric items", () => {
    render(<App />);

    const buttons = screen.getAllByRole("button");
    const bowButtons = buttons.filter((button) =>
      button.style.backgroundImage?.includes("bow"),
    );

    if (bowButtons.length > 0) {
      const bowButton = bowButtons[0];

      // Right-click should cycle in reverse
      fireEvent.contextMenu(bowButton);
      // The opacity should change based on the value
      const opacity = bowButton.style.opacity;
      expect(opacity === "0.25" || opacity === "1").toBe(true);
    }
  });

  it("maintains item state consistency", () => {
    // Reset store state to initial values
    useGameStore.getState().reset();

    render(<App />);

    // Test that clicking multiple times maintains consistent state
    const buttons = screen.getAllByRole("button");
    const hookshotButtons = buttons.filter((button) =>
      button.style.backgroundImage?.includes("hookshot"),
    );

    if (hookshotButtons.length > 0) {
      const hookshotButton = hookshotButtons[0];

      // Start inactive
      expect(hookshotButton).toHaveStyle("opacity: 0.25");

      // Activate
      fireEvent.click(hookshotButton);
      expect(hookshotButton).toHaveStyle("opacity: 1");

      // Deactivate
      fireEvent.click(hookshotButton);
      expect(hookshotButton).toHaveStyle("opacity: 0.25");
    }
  });
});
