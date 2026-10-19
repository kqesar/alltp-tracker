import type { Tri } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { markerStatus } from "./marker-status";

describe("markerStatus", () => {
  it.each([
    [["yes"], "available"],
    [["yes", "yes"], "available"],
    [["yes", "maybe"], "possible"],
    [["yes", "no"], "possible"],
    [["maybe", "no"], "possible"],
    [["no", "no"], "unavailable"],
    [[], "unavailable"],
  ] as [Tri[], string][])("%j shows %s", (tris, status) => {
    expect(markerStatus(tris)).toBe(status);
  });
});
