import { describe, expect, it, vi } from "vitest";
import { saveFile } from "@/utils/saveFile";

describe("saveFile", () => {
  it("downloads through a link in the page, then frees the file URL", () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => "blob:save");
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    let downloaded = "";
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloaded = this.isConnected ? this.download : "";
      });
    saveFile("run.json", "{}");
    expect(downloaded).toBe("run.json");
    expect(document.querySelector("a[download]")).toBeNull();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:save");
    click.mockRestore();
    vi.useRealTimers();
  });
});
