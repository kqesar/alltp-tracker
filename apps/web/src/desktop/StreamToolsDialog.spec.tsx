import { act, fireEvent, render, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tauri = vi.hoisted(() => ({ invoke: vi.fn(), listen: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: tauri.invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: tauri.listen }));

const { useStreamStore } = await import("@/desktop/streamTools");
const { default: StreamToolsDialog, sourcesText } = await import(
  "@/desktop/StreamToolsDialog"
);

const SESSION = {
  address: "http://127.0.0.1:23076/",
  moved: false,
  port: 23076,
  token: "abcdefghijklmnopqrstuv",
  viewers: 0,
};
const URL_OF = (extra = "") =>
  `http://127.0.0.1:23076/?view=obs&token=abcdefghijklmnopqrstuv${extra}`;

const sizeOf = (timer: boolean) => ({ height: timer ? 512 : 448, width: 512 });

const show = (props: Partial<Parameters<typeof StreamToolsDialog>[0]> = {}) => {
  const onClose = vi.fn();
  render(<StreamToolsDialog onClose={onClose} {...props} />);
  return {
    dialog: screen.getByRole("dialog", { name: "Stream tools" }),
    onClose,
  };
};

const running = (changes: Partial<typeof SESSION> = {}) =>
  act(() => useStreamStore.setState({ session: { ...SESSION, ...changes } }));

describe("sourcesText", () => {
  it("counts the sources connected", () => {
    expect(sourcesText(0)).toBe("No source is connected yet.");
    expect(sourcesText(1)).toBe("1 source is connected.");
    expect(sourcesText(2)).toBe("2 sources are connected.");
  });
});

describe("StreamToolsDialog", () => {
  const writeText = vi.fn<(text: string) => Promise<void>>();

  beforeEach(() => {
    vi.clearAllMocks();
    writeText.mockReset().mockResolvedValue();
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    tauri.invoke.mockImplementation(async (command: string) => {
      if (command === "stream_start") return SESSION;
      if (command === "stream_new_tokens") {
        return { ...SESSION, token: "ZYXWVUTSRQPONMLKJIHGFE" };
      }
      return undefined;
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    useStreamStore.setState(useStreamStore.getInitialState(), true);
  });

  it("is off at first, with what it does and nothing to copy", () => {
    const { dialog } = show({ sizeOf });

    const toggle = within(dialog).getByTestId("stream-tools-switch");
    expect(toggle).toHaveAttribute("role", "switch");
    expect(toggle).toHaveAccessibleName("Serve the stream view to OBS");
    expect(toggle).not.toBeChecked();
    expect(toggle).toHaveFocus();
    expect(dialog).toHaveTextContent("stays on when you restart the app");
    expect(screen.queryByTestId("stream-tools-url")).not.toBeInTheDocument();
    expect(screen.queryByTestId("stream-tools-new")).not.toBeInTheDocument();
  });

  it("starts the stream, then shows the address for the source", async () => {
    show({ sizeOf });

    fireEvent.click(screen.getByTestId("stream-tools-switch"));

    const url = await screen.findByLabelText("Browser source URL");
    expect(url).toBe(screen.getByTestId("stream-tools-url"));
    expect(url).toHaveValue(URL_OF());
    expect(url).toHaveAttribute("readonly");
    expect(screen.getByTestId("stream-tools-switch")).toBeChecked();
    expect(screen.getByTestId("stream-tools-viewers")).toHaveTextContent(
      "No source is connected yet.",
    );
    expect(tauri.invoke).toHaveBeenCalledWith("stream_start");
  });

  it("copies the address", async () => {
    show();
    running();

    fireEvent.click(screen.getByTestId("stream-tools-copy"));

    expect(writeText).toHaveBeenCalledWith(URL_OF());
    expect(await screen.findByText("Copied.")).toBe(
      screen.getByTestId("stream-tools-status"),
    );
  });

  it("selects the whole address when it takes focus", () => {
    show();
    running();
    const url = screen.getByTestId("stream-tools-url") as HTMLInputElement;

    fireEvent.focus(url);

    expect(url.selectionStart).toBe(0);
    expect(url.selectionEnd).toBe(URL_OF().length);
  });

  it("asks the view for the run timer, a row more, when ticked", () => {
    const { dialog } = show({ sizeOf });
    running();
    expect(dialog.textContent).toMatch(/512 × 448 for the crispest/);
    expect(dialog.textContent).toMatch(/or 1024 × 896\./);

    fireEvent.click(screen.getByLabelText("Show the run timer under the grid"));

    expect(screen.getByTestId("stream-tools-url")).toHaveValue(
      URL_OF("&timer=1"),
    );
    expect(dialog.textContent).toMatch(/512 × 512 for the crispest/);
  });

  it("offers no timer nor size to a game that has no run timer", () => {
    const { dialog } = show();
    running();

    expect(screen.queryByTestId("stream-tools-timer")).not.toBeInTheDocument();
    expect(dialog.textContent).not.toMatch(/crispest/);
    expect(screen.getByTestId("stream-tools-url")).toHaveValue(URL_OF());
  });

  it("counts the sources as they connect", () => {
    show();
    running();

    running({ viewers: 2 });

    expect(screen.getByTestId("stream-tools-viewers")).toHaveTextContent(
      "2 sources are connected.",
    );
  });

  it("says when the port moved, and what to do", () => {
    show();
    running();
    expect(screen.queryByTestId("stream-tools-moved")).not.toBeInTheDocument();

    running({ moved: true, port: 40_123 });

    expect(screen.getByTestId("stream-tools-moved")).toHaveTextContent(
      "now uses port 40123. Paste the address above into your OBS source again.",
    );
  });

  it("says it listens on the network, and which port a firewall must let in", () => {
    show();
    running({ port: 40_123 });

    expect(screen.getByRole("dialog")).toHaveTextContent(
      "listens on your whole network",
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("port 40123");
  });

  it("turns the stream off", async () => {
    show();
    running();

    fireEvent.click(screen.getByTestId("stream-tools-switch"));

    await vi.waitFor(() =>
      expect(screen.queryByTestId("stream-tools-url")).not.toBeInTheDocument(),
    );
    expect(tauri.invoke).toHaveBeenCalledWith("stream_stop");
    expect(screen.getByTestId("stream-tools-switch")).not.toBeChecked();
  });

  it("keeps the switch focusable and refuses a second change while one runs", () => {
    show();
    act(() => useStreamStore.setState({ pending: true }));
    const toggle = screen.getByTestId("stream-tools-switch");

    expect(toggle).toHaveAttribute("aria-disabled", "true");
    expect(toggle).not.toBeDisabled();
    fireEvent.click(toggle);
    expect(tauri.invoke).not.toHaveBeenCalled();
  });

  it("says why it could not start, as an alert", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    tauri.invoke.mockRejectedValue("Permission denied");
    show();

    fireEvent.click(screen.getByTestId("stream-tools-switch"));

    const alert = await screen.findByRole("alert");
    expect(alert).toBe(screen.getByTestId("stream-tools-error"));
    expect(alert).toHaveTextContent(
      "The stream could not start: Permission denied",
    );
    warn.mockRestore();
  });

  describe("new addresses", () => {
    it("asks first, on the safe choice", () => {
      show();
      running();

      fireEvent.click(screen.getByTestId("stream-tools-new"));

      const confirm = screen.getByRole("dialog", {
        name: "Make new addresses?",
      });
      expect(within(confirm).getByText("Cancel")).toHaveFocus();
      expect(tauri.invoke).not.toHaveBeenCalled();
    });

    it("does nothing when cancelled", () => {
      show();
      running();
      fireEvent.click(screen.getByTestId("stream-tools-new"));

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(
        screen.queryByRole("dialog", { name: "Make new addresses?" }),
      ).toBeNull();
      expect(tauri.invoke).not.toHaveBeenCalled();
      expect(screen.getByTestId("stream-tools-url")).toHaveValue(URL_OF());
    });

    it("replaces the address once confirmed", async () => {
      show();
      running();
      fireEvent.click(screen.getByTestId("stream-tools-new"));

      fireEvent.click(
        within(
          screen.getByRole("dialog", { name: "Make new addresses?" }),
        ).getByRole("button", { name: "New addresses" }),
      );

      await vi.waitFor(() =>
        expect(screen.getByTestId("stream-tools-url")).toHaveValue(
          "http://127.0.0.1:23076/?view=obs&token=ZYXWVUTSRQPONMLKJIHGFE",
        ),
      );
      expect(tauri.invoke).toHaveBeenCalledWith("stream_new_tokens");
    });
  });

  it("closes on Done", () => {
    const { onClose } = show();

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  describe("accessibility", () => {
    const violations = async (container: Element) => {
      const result = await axe.run(container as HTMLElement, {
        // jsdom paints nothing: the browser tests check contrast
        rules: { "color-contrast": { enabled: false } },
      });
      return result.violations.map(
        (violation) =>
          `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`,
      );
    };

    it("has no axe violation, off or running, moved or not", async () => {
      const { dialog } = show({ sizeOf });
      expect(await violations(dialog)).toEqual([]);

      running({ moved: true, port: 40_123, viewers: 1 });
      expect(await violations(dialog)).toEqual([]);
    });
  });
});
