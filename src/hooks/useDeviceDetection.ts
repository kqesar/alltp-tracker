import { useEffect, useState } from "react";

interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouchDevice: boolean;
  orientation: "portrait" | "landscape";
  screenSize: "small" | "medium" | "large";
  pixelRatio: number;
}

/**
 * Hook for detecting device type and capabilities
 * Provides responsive information for mobile optimizations
 */
export const useDeviceDetection = (): DeviceInfo => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => {
    // Initial values (server-side safe)
    return {
      isDesktop: true,
      isMobile: false,
      isTablet: false,
      isTouchDevice: false,
      orientation: "landscape",
      pixelRatio: 1,
      screenSize: "large",
    };
  });

  useEffect(() => {
    const updateDeviceInfo = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const pixelRatio = window.devicePixelRatio || 1;

      // Detect screen size
      let screenSize: "small" | "medium" | "large" = "large";
      if (width <= 480) {
        screenSize = "small";
      } else if (width <= 768) {
        screenSize = "medium";
      }

      // Detect device type based on screen size and user agent
      const isMobile = width <= 768;
      const isTablet = width > 768 && width <= 1024;
      const isDesktop = width > 1024;

      // Detect touch capability
      const isTouchDevice =
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-expect-error - For older browsers
        navigator.msMaxTouchPoints > 0;

      // Detect orientation
      const orientation: "portrait" | "landscape" =
        height > width ? "portrait" : "landscape";

      setDeviceInfo({
        isDesktop,
        isMobile,
        isTablet,
        isTouchDevice,
        orientation,
        pixelRatio,
        screenSize,
      });
    };

    // Initial detection
    updateDeviceInfo();

    // Listen for resize and orientation changes
    window.addEventListener("resize", updateDeviceInfo);
    window.addEventListener("orientationchange", updateDeviceInfo);

    return () => {
      window.removeEventListener("resize", updateDeviceInfo);
      window.removeEventListener("orientationchange", updateDeviceInfo);
    };
  }, []);

  return deviceInfo;
};

/**
 * Hook for detecting if device prefers reduced motion
 */
export const useReducedMotion = (): boolean => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    // Initial check
    setPrefersReducedMotion(mediaQuery.matches);

    // Listen for changes
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return prefersReducedMotion;
};

/**
 * Hook for viewport dimensions
 */
export const useViewport = () => {
  const [viewport, setViewport] = useState(() => ({
    height: typeof window !== "undefined" ? window.innerHeight : 768,
    width: typeof window !== "undefined" ? window.innerWidth : 1024,
  }));

  useEffect(() => {
    const handleResize = () => {
      setViewport({
        height: window.innerHeight,
        width: window.innerWidth,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return viewport;
};
