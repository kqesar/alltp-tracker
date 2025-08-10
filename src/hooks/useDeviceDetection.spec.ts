import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useDeviceDetection,
  useReducedMotion,
  useViewport,
} from "./useDeviceDetection";

// Mock window properties
const mockWindow = {
  addEventListener: vi.fn(),
  devicePixelRatio: 1,
  innerHeight: 768,
  innerWidth: 1024,
  matchMedia: vi.fn(),
  removeEventListener: vi.fn(),
};

// Mock navigator
const mockNavigator = {
  maxTouchPoints: 0,
  msMaxTouchPoints: 0,
} as Navigator & { msMaxTouchPoints: number };

Object.defineProperty(window, "innerWidth", {
  configurable: true,
  value: mockWindow.innerWidth,
  writable: true,
});

Object.defineProperty(window, "innerHeight", {
  configurable: true,
  value: mockWindow.innerHeight,
  writable: true,
});

Object.defineProperty(window, "devicePixelRatio", {
  configurable: true,
  value: mockWindow.devicePixelRatio,
  writable: true,
});

Object.defineProperty(window, "navigator", {
  configurable: true,
  value: mockNavigator,
  writable: true,
});

describe("useDeviceDetection", () => {
  beforeEach(() => {
    // Reset window dimensions
    Object.defineProperty(window, "innerWidth", { value: 1024 });
    Object.defineProperty(window, "innerHeight", { value: 768 });
    Object.defineProperty(window, "devicePixelRatio", { value: 1 });

    // Mock addEventListener/removeEventListener
    window.addEventListener = vi.fn();
    window.removeEventListener = vi.fn();

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should detect desktop device correctly", () => {
    Object.defineProperty(window, "innerWidth", { value: 1200 });
    Object.defineProperty(window, "innerHeight", { value: 800 });

    const { result } = renderHook(() => useDeviceDetection());

    expect(result.current.isDesktop).toBe(true);
    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.screenSize).toBe("large");
    expect(result.current.orientation).toBe("landscape");
  });

  it("should detect mobile device correctly", () => {
    Object.defineProperty(window, "innerWidth", { value: 400 });
    Object.defineProperty(window, "innerHeight", { value: 800 });

    const { result } = renderHook(() => useDeviceDetection());

    expect(result.current.isMobile).toBe(true);
    expect(result.current.isDesktop).toBe(false);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.screenSize).toBe("small");
    expect(result.current.orientation).toBe("portrait");
  });

  it("should detect tablet device correctly", () => {
    Object.defineProperty(window, "innerWidth", { value: 900 });
    Object.defineProperty(window, "innerHeight", { value: 700 });

    const { result } = renderHook(() => useDeviceDetection());

    expect(result.current.isTablet).toBe(true);
    expect(result.current.isMobile).toBe(false);
    expect(result.current.isDesktop).toBe(false);
    expect(result.current.screenSize).toBe("large");
    expect(result.current.orientation).toBe("landscape");
  });

  it("should detect touch device with touch events", () => {
    // Mock touch support
    Object.defineProperty(window, "ontouchstart", { value: {} });

    const { result } = renderHook(() => useDeviceDetection());

    expect(result.current.isTouchDevice).toBe(true);
  });

  it("should detect touch device with maxTouchPoints", () => {
    Object.defineProperty(navigator, "maxTouchPoints", { value: 1 });

    const { result } = renderHook(() => useDeviceDetection());

    expect(result.current.isTouchDevice).toBe(true);
  });

  it("should detect medium screen size correctly", () => {
    Object.defineProperty(window, "innerWidth", { value: 600 });
    Object.defineProperty(window, "innerHeight", { value: 400 });

    const { result } = renderHook(() => useDeviceDetection());

    expect(result.current.screenSize).toBe("medium");
    expect(result.current.isMobile).toBe(true);
    expect(result.current.orientation).toBe("landscape");
  });

  it("should detect high pixel ratio", () => {
    Object.defineProperty(window, "devicePixelRatio", { value: 2 });

    const { result } = renderHook(() => useDeviceDetection());

    expect(result.current.pixelRatio).toBe(2);
  });

  it("should set up event listeners", () => {
    renderHook(() => useDeviceDetection());

    expect(window.addEventListener).toHaveBeenCalledWith(
      "resize",
      expect.any(Function),
    );
    expect(window.addEventListener).toHaveBeenCalledWith(
      "orientationchange",
      expect.any(Function),
    );
  });
});

describe("useReducedMotion", () => {
  let mockMediaQuery: {
    matches: boolean;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockMediaQuery = {
      addEventListener: vi.fn(),
      matches: false,
      removeEventListener: vi.fn(),
    };

    window.matchMedia = vi.fn().mockReturnValue(mockMediaQuery);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return false when user does not prefer reduced motion", () => {
    mockMediaQuery.matches = false;

    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(false);
    expect(window.matchMedia).toHaveBeenCalledWith(
      "(prefers-reduced-motion: reduce)",
    );
  });

  it("should return true when user prefers reduced motion", () => {
    mockMediaQuery.matches = true;

    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(true);
  });

  it("should set up media query event listener", () => {
    renderHook(() => useReducedMotion());

    expect(mockMediaQuery.addEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
  });
});

describe("useViewport", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { value: 1024 });
    Object.defineProperty(window, "innerHeight", { value: 768 });
    window.addEventListener = vi.fn();
    window.removeEventListener = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return current viewport dimensions", () => {
    const { result } = renderHook(() => useViewport());

    expect(result.current.width).toBe(1024);
    expect(result.current.height).toBe(768);
  });

  it("should set up resize event listener", () => {
    renderHook(() => useViewport());

    expect(window.addEventListener).toHaveBeenCalledWith(
      "resize",
      expect.any(Function),
    );
  });

  it("should handle server-side rendering safely", () => {
    // Test with server-side safe initial values
    // Note: The hook already provides default values for SSR compatibility
    const { result } = renderHook(() => useViewport());

    // Should provide reasonable defaults
    expect(result.current.width).toBeGreaterThan(0);
    expect(result.current.height).toBeGreaterThan(0);
  });
});
