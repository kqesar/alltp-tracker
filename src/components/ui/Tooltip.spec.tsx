import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TooltipData } from "@/data/tooltips";
import { Tooltip } from "./Tooltip";

const mockTooltipData: TooltipData = {
  description: "A test item for tooltip testing",
  mechanics: "How this item works",
  shortcuts: ["Space", "Enter"],
  tips: "Useful tips for this item",
  title: "Test Item",
};

describe("Tooltip", () => {
  beforeEach(() => {
    // Mock getBoundingClientRect for positioning
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders trigger element without tooltip initially", () => {
    render(
      <Tooltip data={mockTooltipData}>
        <button type="button">Test Button</button>
      </Tooltip>,
    );

    expect(
      screen.getByRole("button", { name: "Test Button" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows tooltip on hover with delay", async () => {
    const user = userEvent.setup();

    render(
      <Tooltip data={mockTooltipData} delay={100}>
        <button type="button">Test Button</button>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button");
    await user.hover(trigger);

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });

    expect(screen.getByText("Test Item")).toBeInTheDocument();
    expect(
      screen.getByText("A test item for tooltip testing"),
    ).toBeInTheDocument();
  });

  it("hides tooltip on mouse leave", async () => {
    const user = userEvent.setup();

    render(
      <Tooltip data={mockTooltipData} delay={100}>
        <button type="button">Test Button</button>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button");
    await user.hover(trigger);

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });

    await user.unhover(trigger);

    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });
  });

  it("shows tooltip on focus", async () => {
    const user = userEvent.setup();

    render(
      <Tooltip data={mockTooltipData} delay={100}>
        <button type="button">Test Button</button>
      </Tooltip>,
    );

    await user.tab(); // Focus the button

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });
  });

  it("hides tooltip on blur", async () => {
    const user = userEvent.setup();

    render(
      <Tooltip data={mockTooltipData} delay={100}>
        <button type="button">Test Button</button>
      </Tooltip>,
    );

    await user.tab(); // Focus the button

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });

    await user.tab(); // Focus next element (blur the button)

    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });
  });

  it("displays all tooltip sections when provided", async () => {
    const user = userEvent.setup();

    render(
      <Tooltip data={mockTooltipData} delay={100}>
        <button type="button">Test Button</button>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button");
    await user.hover(trigger);

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });

    expect(screen.getByText("Test Item")).toBeInTheDocument();
    expect(
      screen.getByText("A test item for tooltip testing"),
    ).toBeInTheDocument();
    expect(screen.getByText("Mechanics")).toBeInTheDocument();
    expect(screen.getByText("How this item works")).toBeInTheDocument();
    expect(screen.getByText("Tips")).toBeInTheDocument();
    expect(screen.getByText("Useful tips for this item")).toBeInTheDocument();
    expect(screen.getByText("Shortcuts")).toBeInTheDocument();
    expect(screen.getByText("Space")).toBeInTheDocument();
    expect(screen.getByText("Enter")).toBeInTheDocument();
  });

  it("handles dungeon tooltip data with additional fields", async () => {
    const dungeonData = {
      ...mockTooltipData,
      chestCount: 5,
      medallion: "Ether medallion required",
      requirements: ["Lamp", "Hookshot"],
    };

    const user = userEvent.setup();

    render(
      <Tooltip data={dungeonData} delay={100}>
        <button type="button">Test Button</button>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button");
    await user.hover(trigger);

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });

    expect(screen.getByText("Requirements")).toBeInTheDocument();
    expect(screen.getByText("Lamp")).toBeInTheDocument();
    expect(screen.getByText("Hookshot")).toBeInTheDocument();
    expect(screen.getByText("Medallion")).toBeInTheDocument();
    expect(screen.getByText("Ether medallion required")).toBeInTheDocument();
    expect(screen.getByText("Chests")).toBeInTheDocument();
    expect(screen.getByText("5 total chests")).toBeInTheDocument();
  });

  it("supports controlled visibility", async () => {
    const onVisibilityChange = vi.fn();

    const { rerender } = render(
      <Tooltip
        data={mockTooltipData}
        onVisibilityChange={onVisibilityChange}
        visible={false}
      >
        <button type="button">Test Button</button>
      </Tooltip>,
    );

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    rerender(
      <Tooltip
        data={mockTooltipData}
        onVisibilityChange={onVisibilityChange}
        visible={true}
      >
        <button type="button">Test Button</button>
      </Tooltip>,
    );

    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("positions tooltip according to position prop", async () => {
    const user = userEvent.setup();

    render(
      <Tooltip data={mockTooltipData} delay={100} position="bottom">
        <button type="button">Test Button</button>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button");
    await user.hover(trigger);

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveClass("tooltip--bottom");
  });

  it("handles window resize events", async () => {
    const user = userEvent.setup();

    render(
      <Tooltip data={mockTooltipData} delay={100}>
        <button type="button">Test Button</button>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button");
    await user.hover(trigger);

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });

    // Simulate window resize
    fireEvent(window, new Event("resize"));

    // Tooltip should still be visible
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("cleans up timeouts on unmount", () => {
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

    const { unmount } = render(
      <Tooltip data={mockTooltipData}>
        <button type="button">Test Button</button>
      </Tooltip>,
    );

    fireEvent.mouseEnter(screen.getByRole("button"));
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
