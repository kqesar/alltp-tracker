#!/usr/bin/env node

/**
 * Prints the coverage summary produced by vitest as a terminal table.
 *
 * Usage:
 *   pnpm coverage             (reads existing coverage data)
 *   pnpm test:coverage:show   (runs the tests first)
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const coveragePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "coverage",
  "coverage-summary.json",
);

/** Quality bands, best first. */
const BANDS = [
  [90, "🟢", "Excellent"],
  [80, "🟡", "Good"],
  [70, "🟠", "Fair"],
  [0, "🔴", "Needs Improvement"],
];

const band = (pct) => BANDS.find(([floor]) => pct >= floor);

/** Render rows as a pipe-separated table with padded columns. */
const formatTable = (rows) => {
  const widths = rows[0].map((_, column) =>
    Math.max(...rows.map((row) => row[column].length)),
  );
  const line = (row) =>
    row.map((cell, index) => cell.padEnd(widths[index])).join(" | ");

  return [
    line(rows[0]),
    widths.map((width) => "-".repeat(width)).join("-|-"),
    ...rows.slice(1).map(line),
  ].join("\n");
};

console.log("\n📊 Test Coverage Report\n");

if (!existsSync(coveragePath)) {
  console.log('❌ Coverage file not found. Run "pnpm test:coverage" first.\n');
  process.exit(1);
}

try {
  const { total } = JSON.parse(readFileSync(coveragePath, "utf8"));

  console.log(
    formatTable([
      ["Metric", "Coverage", "Status", "Quality"],
      ...["lines", "statements", "functions", "branches"].map((metric) => {
        const { covered, total: count, pct } = total[metric];
        const [, emoji, quality] = band(pct);
        return [
          metric[0].toUpperCase() + metric.slice(1),
          `${covered}/${count} (${pct}%)`,
          emoji,
          quality,
        ];
      }),
    ]),
  );

  const legend = BANDS.map(([floor, emoji, quality]) =>
    floor === 0 ? `${emoji} ${quality}` : `${emoji} ${quality}: ≥${floor}%`,
  );
  console.log(`\n${legend.join("  ")}\n`);
} catch (error) {
  console.log("❌ Error reading coverage data:", error.message);
  process.exit(1);
}
