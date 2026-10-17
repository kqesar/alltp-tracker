import { describe, expect, it } from "vitest";
import { seedFileUrl, seedHashOf } from "./seed-link";

describe("seedHashOf", () => {
  it("takes a bare hash or a link to the seed's page", () => {
    for (const input of [
      "9MQ9gO1wMD",
      " 9MQ9gO1wMD\n",
      "https://alttpr.com/h/9MQ9gO1wMD",
      "https://alttpr.com/en/h/9MQ9gO1wMD",
      "https://www.alttpr.com/fr/h/9MQ9gO1wMD/",
      "alttpr.com/h/9MQ9gO1wMD?ref=discord",
    ]) {
      expect(seedHashOf(input), input).toBe("9MQ9gO1wMD");
    }
  });

  it("refuses anything else", () => {
    for (const input of [
      "",
      "9MQ9gO1w",
      "9MQ9gO1wMD!",
      "https://example.com/h/9MQ9gO1wMD",
      "https://alttpr.com/hash/9MQ9gO1wMD",
      "https://alttpr.com.example.com/h/9MQ9gO1wMD",
    ]) {
      expect(seedHashOf(input), input).toBeNull();
    }
  });
});

describe("seedFileUrl", () => {
  it("points at the bucket alttpr.com's seed page reads", () => {
    expect(seedFileUrl("9MQ9gO1wMD")).toBe(
      "https://alttpr-patch-data.s3.us-east-2.amazonaws.com/9MQ9gO1wMD.json",
    );
  });
});
