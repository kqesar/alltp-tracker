import { render, screen } from "@testing-library/react";
import { generate } from "lean-qr";
import { describe, expect, it } from "vitest";
import QrCode, { modulesPath } from "@/components/ui/QrCode";

/** The dark modules a path draws, read back as "x,y" cells. */
const cellsOf = (path: string): Set<string> => {
  const cells = new Set<string>();
  for (const [, x, y, run] of path.matchAll(/M(\d+) (\d+)h(\d+)v1h-\3z/g)) {
    for (let step = 0; step < Number(run); step++) {
      cells.add(`${Number(x) + step},${y}`);
    }
  }
  return cells;
};

describe("QrCode", () => {
  it("draws exactly the modules lean-qr computed, shifted by the quiet zone", () => {
    const text = "https://example.test/alltp-tracker/#run=abc_DEF-123";
    const bitmap = generate(text);
    const expected = new Set<string>();
    for (let y = 0; y < bitmap.size; y++) {
      for (let x = 0; x < bitmap.size; x++) {
        if (bitmap.get(x, y)) expected.add(`${x + 4},${y + 4}`);
      }
    }

    render(<QrCode label="QR" text={text} />);
    const svg = screen.getByRole("img", { name: "QR" });
    const path = svg.querySelector("path")?.getAttribute("d") ?? "";

    expect(expected.size).toBeGreaterThan(0);
    expect(cellsOf(path)).toEqual(expected);
    // The quiet zone is in the viewBox: 4 modules on each side
    expect(svg.getAttribute("viewBox")).toBe(
      `0 0 ${bitmap.size + 8} ${bitmap.size + 8}`,
    );
    // Dark on light whatever the theme
    expect(svg.querySelector("rect")?.getAttribute("fill")).toBe("#fff");
    expect(svg.querySelector("path")?.getAttribute("fill")).toBe("#000");
  });

  it("merges a horizontal run of modules into one rectangle", () => {
    const grid = ["110", "000", "011"];
    const path = modulesPath({
      get: (x, y) => grid[y][x] === "1",
      size: 3,
    });

    expect(path).toBe("M0 0h2v1h-2zM1 2h2v1h-2z");
  });

  it("says so instead of drawing a link a QR code cannot hold", () => {
    render(<QrCode label="QR" text={"a".repeat(3000)} />);

    expect(screen.getByTestId("share-qr-none")).toHaveTextContent(
      "too long for a QR code",
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
