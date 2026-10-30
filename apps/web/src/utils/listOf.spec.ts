import { describe, expect, it } from "vitest";
import { listOf } from "@/utils/listOf";

describe("listOf", () => {
  it("joins words as a sentence lists them", () => {
    expect(listOf([])).toBe("");
    expect(listOf(["a"])).toBe("a");
    expect(listOf(["a", "b"])).toBe("a and b");
    expect(listOf(["a", "b", "c"])).toBe("a, b and c");
  });
});
