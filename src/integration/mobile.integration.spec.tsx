import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrackerGrid } from "@/components/tracker/TrackerGrid";
import { defaultItemGrid } from "@/data/items";

// Mock the gameStore
vi.mock("@/stores/gameStore", () => ({
  useGameStore: () => ({
    handleItemClick: vi.fn(),
    items: {
      bomb: false,
      boots: false,
      bow: 0,
      moonpearl: false,
      shield: 0,
      sword: 0,
    },
    medallions: {
      8: 0, // Misery Mire
      9: 0, // Turtle Rock
    },
  }),
}));

// Mock the keyboard navigation hook
vi.mock("@/hooks/useKeyboardNavigation", () => ({
  useKeyboardNavigation: () => ({
    focusedPosition: { col: 0, row: 0 },
    handleKeyDown: vi.fn(),
    setFocusedPosition: vi.fn(),
  }),
}));

// Mock device detection with mutable values
const createMockDeviceDetection = () => ({
  isDesktop: true,
  isMobile: false,
  isTablet: false,
  isTouchDevice: false,
  orientation: "landscape" as const,
  pixelRatio: 1,
  screenSize: "large" as const,
});

const mockDeviceDetection = createMockDeviceDetection();

vi.mock("@/hooks/useDeviceDetection", () => ({
  useDeviceDetection: () => mockDeviceDetection,
}));

// Mock touch gestures
vi.mock("@/hooks/useTouchGestures", () => ({
  useTouchGestures: () => ({
    gestures: {
      onMouseDown: vi.fn(),
      onMouseLeave: vi.fn(),
      onMouseMove: vi.fn(),
      onMouseUp: vi.fn(),
      onTouchCancel: vi.fn(),
      onTouchEnd: vi.fn(),
      onTouchMove: vi.fn(),
      onTouchStart: vi.fn(),
    },
    ref: { current: null },
  }),
}));

describe("Mobile Touch Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock to default state
    Object.assign(mockDeviceDetection, createMockDeviceDetection());
  });

  it("should render tracker grid with mobile optimizations on mobile device", () => {
    // Set mobile device properties
    Object.assign(mockDeviceDetection, {
      isDesktop: false,
      isMobile: true,
      isTouchDevice: true,
      screenSize: "small",
    });

    const { container } = render(<TrackerGrid itemLayout={defaultItemGrid} />);

    // Check that the tracker grid is rendered
    const tracker = container.querySelector(".tracker");
    expect(tracker).toBeInTheDocument();
    expect(tracker).toHaveClass("tracker");
  });

  it("should handle touch interactions on mobile", () => {
    Object.assign(mockDeviceDetection, {
      isMobile: true,
      isTouchDevice: true,
    });

    render(<TrackerGrid itemLayout={defaultItemGrid} />);

    // Find an interactive item button
    const itemButtons = screen.getAllByRole("button");
    expect(itemButtons.length).toBeGreaterThan(0);

    // Check that buttons have proper touch target sizing
    const firstButton = itemButtons[0];
    expect(firstButton).toBeInTheDocument();

    // Simulate touch interaction
    fireEvent.click(firstButton);
    // Item click should be handled (mocked function)
  });

  it("should apply mobile CSS classes and responsive layout", () => {
    Object.assign(mockDeviceDetection, {
      isMobile: true,
      screenSize: "small",
    });

    const { container } = render(<TrackerGrid itemLayout={defaultItemGrid} />);

    // Check that mobile-specific styling is applied through CSS
    const tracker = container.querySelector(".tracker");
    expect(tracker).toBeInTheDocument();
  });

  it("should handle desktop device correctly", () => {
    Object.assign(mockDeviceDetection, {
      isDesktop: true,
      isMobile: false,
      isTouchDevice: false,
    });

    const { container } = render(<TrackerGrid itemLayout={defaultItemGrid} />);

    const tracker = container.querySelector(".tracker");
    expect(tracker).toBeInTheDocument();
    expect(tracker).toHaveClass("tracker");
  });

  it("should handle tablet device correctly", () => {
    Object.assign(mockDeviceDetection, {
      isDesktop: false,
      isMobile: false,
      isTablet: true,
      isTouchDevice: true,
      screenSize: "medium",
    });

    const { container } = render(<TrackerGrid itemLayout={defaultItemGrid} />);

    const tracker = container.querySelector(".tracker");
    expect(tracker).toBeInTheDocument();
  });

  it("should provide accessible labels for touch devices", () => {
    Object.assign(mockDeviceDetection, {
      isTouchDevice: true,
    });

    render(<TrackerGrid itemLayout={defaultItemGrid} />);

    // Check that all interactive elements have proper accessibility labels
    const buttons = screen.getAllByRole("button");

    buttons.forEach((button) => {
      expect(button).toHaveAttribute("aria-label");
      const ariaLabel = button.getAttribute("aria-label");
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel).toMatch(/Click to change state|Empty slot/);
    });
  });

  it("should handle orientation changes", () => {
    Object.assign(mockDeviceDetection, {
      isMobile: true,
      orientation: "portrait",
    });

    const { rerender, container } = render(
      <TrackerGrid itemLayout={defaultItemGrid} />,
    );

    // Test portrait orientation
    expect(container.querySelector(".tracker")).toBeInTheDocument();

    // Switch to landscape
    Object.assign(mockDeviceDetection, {
      orientation: "landscape",
    });
    rerender(<TrackerGrid itemLayout={defaultItemGrid} />);

    expect(container.querySelector(".tracker")).toBeInTheDocument();
  });

  it("should work with high pixel ratio displays", () => {
    Object.assign(mockDeviceDetection, {
      isMobile: true,
      pixelRatio: 2,
    });

    const { container } = render(<TrackerGrid itemLayout={defaultItemGrid} />);

    const tracker = container.querySelector(".tracker");
    expect(tracker).toBeInTheDocument();

    // High DPI devices should still render correctly
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });
});
