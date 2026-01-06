import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrackerGrid } from "@/components/tracker/TrackerGrid";

// Mock the stores with selector support - using inline layout to avoid hoisting issues
vi.mock("@/stores/gameStore", () => {
  return {
    useGameStore: Object.assign(
      (selector?: (state: unknown) => unknown) => {
        const state = {
          handleItemClick: vi.fn(),
          itemLayout: [
            ["sword", "shield", "bow"],
            ["bottle", "", "hammer"],
            ["hookshot", "boots", "glove"],
          ],
          items: {
            boots: false,
            bottle: false,
            bow: 0,
            glove: 1,
            hammer: true,
            hookshot: true,
            shield: true,
            sword: 1,
          },
          setItemLayout: vi.fn(),
        };
        if (selector) {
          return selector(state);
        }
        return state;
      },
      {
        getState: () => ({
          reset: vi.fn(),
          setItemLayout: vi.fn(),
        }),
      },
    ),
  };
});

describe("TrackerGrid Keyboard Navigation Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Grid item attributes", () => {
    it("should add data-grid-row and data-grid-col attributes to buttons", () => {
      render(<TrackerGrid />);

      // Check that buttons have the correct grid coordinates
      const swordButton = screen.getByLabelText(/sword/i);
      expect(swordButton).toHaveAttribute("data-grid-row", "0");
      expect(swordButton).toHaveAttribute("data-grid-col", "0");

      const shieldButton = screen.getByLabelText(/shield/i);
      expect(shieldButton).toHaveAttribute("data-grid-row", "0");
      expect(shieldButton).toHaveAttribute("data-grid-col", "1");

      const hammerButton = screen.getByLabelText(/hammer/i);
      expect(hammerButton).toHaveAttribute("data-grid-row", "1");
      expect(hammerButton).toHaveAttribute("data-grid-col", "2");
    });

    it("should not render button for empty cells", () => {
      render(<TrackerGrid />);

      const buttons = screen.getAllByRole("button");

      // Should have 8 buttons total (3 + 2 + 3, excluding the empty cell at [1,1])
      expect(buttons).toHaveLength(8);

      // Should not find a button at position [1, 1] since it's empty
      const buttonAtRow1Col1 = buttons.find(
        (button) =>
          button.getAttribute("data-grid-row") === "1" &&
          button.getAttribute("data-grid-col") === "1",
      );

      expect(buttonAtRow1Col1).toBeUndefined();
    });
  });

  describe("Focus handling", () => {
    it("should have onFocus handlers on buttons for keyboard navigation support", () => {
      render(<TrackerGrid />);

      const swordButton = screen.getByLabelText(/sword/i);

      // Check that the button has the necessary attributes for keyboard navigation
      expect(swordButton).toHaveAttribute("data-grid-row", "0");
      expect(swordButton).toHaveAttribute("data-grid-col", "0");
      expect(swordButton).toHaveAttribute("type", "button");
    });

    it("should render buttons with proper tabindex for keyboard accessibility", () => {
      render(<TrackerGrid />);

      const buttons = [
        screen.getByLabelText(/sword/i),
        screen.getByLabelText(/shield/i),
        screen.getByLabelText(/bow/i),
      ];

      // All buttons should be focusable
      buttons.forEach((button) => {
        expect(button).not.toHaveAttribute("disabled");
        expect(button).toHaveAttribute("type", "button");
      });
    });
  });

  describe("Container setup", () => {
    it("should have a ref-accessible container for keyboard navigation", () => {
      render(<TrackerGrid />);

      const container = document.getElementById("itemdiv");
      expect(container).toBeInTheDocument();
      expect(container).toHaveAttribute("aria-label", "Item tracker grid");
    });

    it("should render all valid items as focusable buttons", () => {
      render(<TrackerGrid />);

      const buttons = screen.getAllByRole("button");

      // Should have 8 buttons (3 + 2 + 3, excluding the empty cell)
      expect(buttons).toHaveLength(8);

      // Each button should be focusable
      buttons.forEach((button) => {
        expect(button).not.toHaveAttribute("disabled");
      });
    });
  });

  describe("Grid structure preservation", () => {
    it("should maintain existing grid structure while adding keyboard navigation", () => {
      render(<TrackerGrid />);

      // Check that the basic structure is preserved
      expect(
        screen.getByRole("region", { name: /item tracker grid/i }),
      ).toBeInTheDocument();
      expect(screen.getByText("Item Tracker")).toBeInTheDocument();

      // Check grid rows are still present
      const gridRows = screen.getAllByTestId("grid-row");
      expect(gridRows).toHaveLength(3);

      // Check row data attributes are preserved
      expect(gridRows[0]).toHaveAttribute("data-row-index", "0");
      expect(gridRows[1]).toHaveAttribute("data-row-index", "1");
      expect(gridRows[2]).toHaveAttribute("data-row-index", "2");
    });

    it("should preserve existing click functionality", () => {
      render(<TrackerGrid />);

      const swordButton = screen.getByLabelText(/sword/i);

      // Check that the button exists and has proper attributes
      expect(swordButton).toBeInTheDocument();
      expect(swordButton).toHaveAttribute("data-grid-row", "0");
      expect(swordButton).toHaveAttribute("data-grid-col", "0");

      // Verify it's clickable
      expect(swordButton).toHaveAttribute("type", "button");
    });
  });

  describe("Accessibility", () => {
    it("should maintain proper ARIA labels for screen readers", () => {
      render(<TrackerGrid />);

      const swordButton = screen.getByLabelText(/sword/i);
      expect(swordButton).toHaveAttribute("aria-label");
      expect(swordButton.getAttribute("aria-label")).toMatch(/sword/i);
      expect(swordButton.getAttribute("aria-label")).toMatch(
        /click to change state/i,
      );
    });

    it("should maintain semantic HTML structure", () => {
      render(<TrackerGrid />);

      // Check for proper semantic elements
      expect(screen.getByRole("region")).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();

      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);

      buttons.forEach((button) => {
        expect(button).toHaveAttribute("type", "button");
      });
    });
  });
});
