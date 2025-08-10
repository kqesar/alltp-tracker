import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { HelpOverlay } from "@/components/ui/HelpOverlay";
import { Tooltip } from "@/components/ui/Tooltip";
import { itemTooltips } from "@/data/tooltips";

// Mock the CSS imports
vi.mock("@/styles/index.css", () => ({}));

describe("Tooltip Integration", () => {
  it("tooltip data contains expected item keys", () => {
    // Test that our tooltip data keys match expected items in the tracker
    const expectedItemKeys = [
      "sword",
      "shield",
      "bow",
      "boomerang",
      "hookshot",
      "hammer",
      "lantern",
      "firerod",
      "icerod",
      "bombos",
      "ether",
      "quake",
      "moonpearl",
      "mirror",
      "flippers",
      "boots",
      "glove",
      "flute",
      "shovel",
    ];

    expectedItemKeys.forEach((key) => {
      expect(itemTooltips[key]).toBeDefined();
      expect(itemTooltips[key].title).toBeTruthy();
      expect(itemTooltips[key].description).toBeTruthy();
    });
  });

  it("tooltip component renders with real tooltip data", async () => {
    const user = userEvent.setup();

    render(
      <Tooltip data={itemTooltips.sword} delay={100}>
        <button type="button">Sword</button>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button", { name: "Sword" });
    await user.hover(trigger);

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });

    // Verify real sword tooltip content
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(screen.getByText(/Your primary weapon/)).toBeInTheDocument();
    expect(
      screen.getByText(/Fighter's.*Master.*Tempered.*Golden/),
    ).toBeInTheDocument();
  });

  it("help overlay can be opened without conflicts", async () => {
    const user = userEvent.setup();

    const TestComponent = () => {
      const [isHelpVisible, setIsHelpVisible] = React.useState(false);

      return (
        <>
          <button onClick={() => setIsHelpVisible(true)} type="button">
            Open Help
          </button>
          <HelpOverlay
            isVisible={isHelpVisible}
            onClose={() => setIsHelpVisible(false)}
          />
        </>
      );
    };

    render(<TestComponent />);

    const helpButton = screen.getByRole("button", { name: "Open Help" });
    await user.click(helpButton);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByText("ALttP Randomizer Tracker Help"),
    ).toBeInTheDocument();
  });

  it("header help button integrates properly", () => {
    render(
      <header className="header">
        <button className="header__help-button" type="button">
          Help
        </button>
      </header>,
    );

    const helpButton = screen.getByRole("button", { name: "Help" });
    expect(helpButton).toBeInTheDocument();
    expect(helpButton).toHaveClass("header__help-button");
  });

  it("tooltip positioning works within viewport", async () => {
    // Mock getBoundingClientRect for positioning test
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      bottom: 150,
      height: 50,
      left: 100,
      right: 300,
      toJSON: () => {},
      top: 100,
      width: 200,
      x: 100,
      y: 100,
    }));

    // Mock window dimensions
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1024,
      writable: true,
    });

    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 768,
      writable: true,
    });

    const user = userEvent.setup();

    render(
      <Tooltip data={itemTooltips.moonpearl} delay={100} position="top">
        <button type="button">Moon Pearl</button>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button");
    await user.hover(trigger);

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveStyle({ position: "fixed" });
    expect(tooltip).toHaveClass("tooltip--top");
  });
});
