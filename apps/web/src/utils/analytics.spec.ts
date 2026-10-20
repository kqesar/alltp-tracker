import { describe, expect, it } from "vitest";
import {
  asksNotToBeTracked,
  COUNTED_HOST,
  GOATCOUNTER_CODE,
  startAnalytics,
} from "@/utils/analytics";

const browser = { doNotTrack: null as string | null };

describe("asksNotToBeTracked", () => {
  it("honours Do Not Track and Global Privacy Control", () => {
    expect(asksNotToBeTracked({ doNotTrack: "1" })).toBe(true);
    expect(
      asksNotToBeTracked({ doNotTrack: null, globalPrivacyControl: true }),
    ).toBe(true);
  });

  it("counts a visitor who sent neither, or said no to both", () => {
    expect(asksNotToBeTracked({ doNotTrack: null })).toBe(false);
    expect(asksNotToBeTracked({ doNotTrack: "0" })).toBe(false);
    expect(
      asksNotToBeTracked({ doNotTrack: "0", globalPrivacyControl: false }),
    ).toBe(false);
  });
});

describe("startAnalytics", () => {
  it("adds GoatCounter's script once, async, aimed at the site's counter", () => {
    document.head.replaceChildren();

    expect(startAnalytics(document, browser, COUNTED_HOST)).toBe(true);

    const scripts = document.head.querySelectorAll("script");
    expect(scripts).toHaveLength(1);
    expect(scripts[0].async).toBe(true);
    expect(scripts[0].src).toBe("https://gc.zgo.at/count.js");
    expect(scripts[0].dataset.goatcounter).toBe(
      `https://${GOATCOUNTER_CODE}.goatcounter.com/count`,
    );
    expect(scripts[0].dataset.goatcounter).toBe(
      "https://rando-atlas.goatcounter.com/count",
    );
  });

  it.each(["localhost", "127.0.0.1", "someone.github.io", ""])(
    "adds nothing on %j: only the site's host counts",
    (host) => {
      document.head.replaceChildren();

      expect(startAnalytics(document, browser, host)).toBe(false);

      expect(document.head.querySelector("script")).toBeNull();
    },
  );

  it("adds nothing for a visitor who asked not to be tracked", () => {
    document.head.replaceChildren();

    expect(startAnalytics(document, { doNotTrack: "1" }, COUNTED_HOST)).toBe(
      false,
    );
    expect(
      startAnalytics(
        document,
        { doNotTrack: null, globalPrivacyControl: true },
        COUNTED_HOST,
      ),
    ).toBe(false);

    expect(document.head.querySelector("script")).toBeNull();
  });
});
