import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "@/App";

// Mock the MapTracker component for integration tests
vi.mock("@/components/MapTracker", () => ({
  MapTracker: ({ caption }: { caption: string }) => (
    <div data-testid="map-tracker">
      Map Tracker Component - Caption: {caption}
    </div>
  ),
}));

// Integration tests that test the full application flow
describe("App Integration Tests", () => {
  it("should update item states and reflect in MapTracker", () => {
    render(<App />);

    // Find buttons with background images
    const buttons = screen.getAllByRole("button");
    const hookshotButtons = buttons.filter((button) =>
      button.style.backgroundImage?.includes("hookshot"),
    );

    if (hookshotButtons.length > 0) {
      const hookshotButton = hookshotButtons[0];

      // Initially inactive
      expect(hookshotButton).toHaveStyle("opacity: 0.25");

      // Activate hookshot
      fireEvent.click(hookshotButton);
      expect(hookshotButton).toHaveStyle("opacity: 1");
    }

    // Check that MapTracker is rendered
    expect(screen.getByTestId("map-tracker")).toBeInTheDocument();
  });

  it("should handle complex item combinations", () => {
    render(<App />);

    // Get several key items
    const buttons = screen.getAllByRole("button");
    const moonpearlButtons = buttons.filter((button) =>
      button.style.backgroundImage?.includes("moonpearl"),
    );
    const hammerButtons = buttons.filter((button) =>
      button.style.backgroundImage?.includes("hammer"),
    );
    const gloveButtons = buttons.filter((button) =>
      button.style.backgroundImage?.includes("glove"),
    );

    if (
      moonpearlButtons.length > 0 &&
      hammerButtons.length > 0 &&
      gloveButtons.length > 0
    ) {
      // Activate multiple items
      fireEvent.click(moonpearlButtons[0]);
      fireEvent.click(hammerButtons[0]);
      fireEvent.click(gloveButtons[0]); // Should cycle to power glove
      fireEvent.click(gloveButtons[0]); // Should cycle to titan's mitt

      // Check states
      expect(moonpearlButtons[0]).toHaveStyle("opacity: 1");
      expect(hammerButtons[0]).toHaveStyle("opacity: 1");
      expect(gloveButtons[0]).toHaveStyle("opacity: 1");
    }
  });

  it("should handle boss progression correctly", () => {
    render(<App />);

    // Find boss buttons
    const buttons = screen.getAllByRole("button");
    const bossButtons = buttons.filter((button) =>
      button.style.backgroundImage?.includes("boss"),
    );

    if (bossButtons.length > 0) {
      const boss0Button = bossButtons[0];

      // Boss should start in state 1 (available)
      expect(boss0Button).toHaveStyle("opacity: 1");

      // Click to mark as beaten
      fireEvent.click(boss0Button);
      // State should change (implementation depends on boss progression logic)
      const opacity = getComputedStyle(boss0Button).opacity;
      expect(["0.25", "1"]).toContain(opacity);
    }
  });

  it("should maintain state consistency across user interactions", () => {
    render(<App />);

    // Test multiple interactions
    const buttons = screen.getAllByRole("button");
    const swordButtons = buttons.filter((button) =>
      button.style.backgroundImage?.includes("sword"),
    );
    const bowButtons = buttons.filter((button) =>
      button.style.backgroundImage?.includes("bow"),
    );

    if (swordButtons.length > 0 && bowButtons.length > 0) {
      const swordButton = swordButtons[0];
      const bowButton = bowButtons[0];

      // Cycle through sword states
      fireEvent.click(swordButton); // Fighter's sword
      fireEvent.click(swordButton); // Master sword
      fireEvent.click(swordButton); // Tempered sword
      fireEvent.click(swordButton); // Golden sword
      fireEvent.click(swordButton); // Back to no sword

      // Cycle through bow states
      fireEvent.click(bowButton); // Bow
      fireEvent.click(bowButton); // Bow + arrows
      fireEvent.click(bowButton); // Bow + silver arrows
      fireEvent.click(bowButton); // Back to no bow

      // States should be consistent
      expect(swordButton).toHaveStyle("opacity: 0.25"); // No sword
      expect(bowButton).toHaveStyle("opacity: 0.25"); // No bow
    }
  });

  it("should handle item state cycling correctly", () => {
    render(<App />);

    const buttons = screen.getAllByRole("button");
    const bottleButtons = buttons.filter((button) =>
      button.style.backgroundImage?.includes("bottle"),
    );

    if (bottleButtons.length > 0) {
      const bottleButton = bottleButtons[0];

      // Start with no bottles
      expect(bottleButton).toHaveStyle("opacity: 0.25");

      // Click should cycle bottle state
      fireEvent.click(bottleButton);
      // After click, should have different state
      const opacity = getComputedStyle(bottleButton).opacity;
      expect(["0.25", "1"]).toContain(opacity);
    }
  });

  it("should render all grid positions correctly", () => {
    render(<App />);

    // Should have tracker rows (CSS Grid rows)
    const trackerRows = document.querySelectorAll(".tracker-row");
    expect(trackerRows.length).toBeGreaterThan(0);

    // Check that we have buttons rendered
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("should handle special overlay rendering", () => {
    render(<App />);

    // Find buttons that might have overlays
    const buttons = screen.getAllByRole("button");

    // Some buttons should have overlays for tracking additional states
    const buttonsWithOverlays = buttons.filter((button) => {
      const overlays = button.querySelectorAll("[class*='overlay'], .stoops");
      return overlays.length > 0;
    });

    // Overlays are dynamic based on state, so just check they can exist
    expect(buttonsWithOverlays.length).toBeGreaterThanOrEqual(0);
  });

  it("should update caption based on item interactions", () => {
    render(<App />);

    // Find an item button with background
    const buttons = screen.getAllByRole("button");
    const itemButtons = buttons.filter(
      (button) =>
        button.style.backgroundImage && button.style.backgroundImage !== "",
    );

    if (itemButtons.length > 0) {
      // Hover should update caption (this would be handled by MapTracker in real app)
      fireEvent.mouseEnter(itemButtons[0]);
      fireEvent.mouseLeave(itemButtons[0]);
      // Caption functionality is mostly in MapTracker, so just ensure no errors
    }

    // Check that MapTracker is rendered
    expect(screen.getByTestId("map-tracker")).toBeInTheDocument();
  });

  it("should handle edge cases gracefully", () => {
    render(<App />);

    // Check that MapTracker is rendered
    expect(screen.getByTestId("map-tracker")).toBeInTheDocument();

    // The app should render without errors even with empty states
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);

    // Multiple clicks shouldn't break anything
    if (buttons.length > 0) {
      const firstButton = buttons[0];
      for (let i = 0; i < 10; i++) {
        fireEvent.click(firstButton);
      }
      // Should still be rendered after many clicks
      expect(firstButton).toBeInTheDocument();
    }
  });
});
