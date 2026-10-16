import { afterEach, describe, expect, it } from "vitest";
import { altKey, commandKey, isApplePlatform } from "@/utils/platform";

/** Have the browser report a platform, as Chromium and the others do. */
const reportPlatform = ({
  hint,
  legacy,
}: {
  /** `navigator.userAgentData.platform`, Chromium's client hint */
  hint?: string;
  /** `navigator.platform` */
  legacy?: string;
}) => {
  Object.defineProperty(navigator, "userAgentData", {
    configurable: true,
    value: hint === undefined ? undefined : { platform: hint },
  });
  Object.defineProperty(navigator, "platform", {
    configurable: true,
    value: legacy ?? "",
  });
};

/** Back to jsdom's own navigator. */
const forgetPlatform = () => {
  Reflect.deleteProperty(navigator, "userAgentData");
  Reflect.deleteProperty(navigator, "platform");
};

describe("the platform", () => {
  afterEach(forgetPlatform);

  it.each([
    ["Chromium on macOS", { hint: "macOS", legacy: "MacIntel" }],
    ["Safari on a Mac", { legacy: "MacIntel" }],
    ["Safari on an iPhone", { legacy: "iPhone" }],
    ["an iPad, which reports a Mac", { legacy: "MacIntel" }],
    ["an empty client hint", { hint: "", legacy: "MacIntel" }],
  ])("is Apple's for %s: Cmd and Option", (_, report) => {
    reportPlatform(report);

    expect(isApplePlatform()).toBe(true);
    expect(commandKey()).toBe("Cmd");
    expect(altKey()).toBe("Option");
  });

  it.each([
    ["Chromium on Windows", { hint: "Windows", legacy: "Win32" }],
    ["Firefox on Linux", { legacy: "Linux x86_64" }],
    ["Chromium on Android", { hint: "Android", legacy: "Linux armv8l" }],
    ["a browser that says nothing", {}],
  ])("is not for %s: Ctrl and Alt", (_, report) => {
    reportPlatform(report);

    expect(isApplePlatform()).toBe(false);
    expect(commandKey()).toBe("Ctrl");
    expect(altKey()).toBe("Alt");
  });

  it("trusts the client hint over the older property", () => {
    reportPlatform({ hint: "Windows", legacy: "MacIntel" });

    expect(isApplePlatform()).toBe(false);
  });
});
