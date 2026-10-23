import { afterEach, describe, expect, it, vi } from "vitest";
import { copyStatus, copyText } from "@/utils/clipboard";

/** jsdom has no Clipboard API: give the page one, or take it away. */
const setClipboard = (clipboard: Partial<Clipboard> | undefined) =>
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: clipboard,
  });

describe("copyText", () => {
  const { execCommand } = document;
  afterEach(() => {
    document.execCommand = execCommand;
  });

  it("puts the text on the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    const select = vi.fn();

    expect(await copyText("hello", select)).toBe("copied");

    expect(writeText).toHaveBeenCalledWith("hello");
    expect(select).not.toHaveBeenCalled();
  });

  it("selects the text and copies it with the older command when refused", async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error("denied")) });
    const command = vi.fn(() => true);
    document.execCommand = command;
    const select = vi.fn();

    expect(await copyText("hello", select)).toBe("copied");

    expect(select).toHaveBeenCalledOnce();
    expect(command).toHaveBeenCalledWith("copy");
  });

  it("leaves the text selected for the player when nothing can copy", async () => {
    setClipboard(undefined);
    document.execCommand = vi.fn(() => false);
    const select = vi.fn();

    expect(await copyText("hello", select)).toBe("manual");

    expect(select).toHaveBeenCalledOnce();
  });

  it("has nothing to fall back on without a selection", async () => {
    setClipboard(undefined);
    const command = vi.fn(() => true);
    document.execCommand = command;

    expect(await copyText("hello")).toBe("manual");

    expect(command).not.toHaveBeenCalled();
  });
});

describe("copyStatus", () => {
  it("says what happened, with the player's own copy key", () => {
    expect(copyStatus("copied")).toBe("Copied.");
    expect(copyStatus("manual")).toBe("Press Ctrl+C to copy.");
  });
});
