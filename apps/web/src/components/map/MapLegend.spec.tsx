import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MapLegend } from "@/components/map/MapLegend";

describe("MapLegend", () => {
  it("renders the five availability states, by precedence", () => {
    render(<MapLegend />);

    expect(
      [...document.querySelectorAll(".map-legend__item")].map(
        (item) => item.textContent,
      ),
    ).toEqual([
      "Available now",
      "Maybe, or only some",
      "Visible, not reachable yet",
      "Out of logic",
      "Opened / cleared",
    ]);
    // Each swatch draws its state's colour and glyph
    expect(
      [...document.querySelectorAll(".map-legend__swatch")].map((swatch) =>
        swatch.className.replace("map-legend__swatch state-glyph ", ""),
      ),
    ).toEqual(["available", "possible", "seen", "unavailable", "opened"]);
  });

  it("leaves out the seen state for a map that has none", () => {
    render(<MapLegend seen={false} />);
    expect(
      [...document.querySelectorAll(".map-legend__swatch")].map((swatch) =>
        swatch.className.replace("map-legend__swatch state-glyph ", ""),
      ),
    ).toEqual(["available", "possible", "unavailable", "opened"]);
  });

  it("exposes an accessible label", () => {
    render(<MapLegend />);
    expect(
      screen.getByRole("region", { name: /map availability legend/i }),
    ).toBeInTheDocument();
  });
});
