import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  blockedWhy,
  ConnectDialog,
} from "@/games/archipelago/components/ConnectDialog";
import {
  AP_PASSWORD_KEY,
  setRuntimeOptions,
  stop,
  useApConnectionStore,
} from "@/games/archipelago/connection";
import { ROOM_ADDRESS, startRoom } from "@/games/archipelago/fixtures";

const state = () => useApConnectionStore.getState();

const open = () => render(<ConnectDialog onClose={() => {}} />);

const type = (testId: string, value: string) =>
  fireEvent.change(screen.getByTestId(testId), { target: { value } });

const submit = () => fireEvent.click(screen.getByTestId("ap-connect"));

/** archipelago.gg's room status, as `fetch` answers it. */
const roomStatus = (body: unknown, ok = true) =>
  vi.fn(async () => ({ json: async () => body, ok }) as Response);

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  useApConnectionStore.setState(useApConnectionStore.getInitialState(), true);
});

afterEach(() => {
  stop();
  setRuntimeOptions({});
  vi.unstubAllGlobals();
});

describe("the connect dialog", () => {
  it("connects with the room, slot and password typed", async () => {
    startRoom();
    open();
    expect(screen.getByTestId("ap-room-input")).toHaveAccessibleName("Room");
    expect(screen.getByTestId("ap-room-input")).toHaveAccessibleDescription(
      /archipelago\.gg:38281/,
    );
    expect(screen.getByTestId("ap-password-input")).toHaveAttribute(
      "type",
      "password",
    );
    expect(screen.getByTestId("ap-password-input")).toHaveAttribute(
      "autocomplete",
      "off",
    );
    type("ap-room-input", `/connect ${ROOM_ADDRESS}`);
    type("ap-slot-input", "Link");
    type("ap-password-input", "secret");
    submit();
    await vi.waitFor(() =>
      expect(screen.getByTestId("ap-connect-headline")).toHaveTextContent(
        "Connected",
      ),
    );
    expect(state()).toMatchObject({
      address: `/connect ${ROOM_ADDRESS}`,
      roomLink: null,
      slot: "Link",
    });
    expect(sessionStorage.getItem(AP_PASSWORD_KEY)).toBe("secret");
    expect(localStorage.getItem(AP_PASSWORD_KEY)).toBeNull();
    expect(screen.getByTestId("ap-step-slot")).toHaveAttribute(
      "data-state",
      "done",
    );
    expect(screen.getByTestId("ap-steps-count")).toHaveTextContent(
      "4 of 4 steps done",
    );
    expect(screen.getByTestId("ap-connect")).toHaveTextContent("Connect again");
    fireEvent.click(screen.getByTestId("ap-disconnect"));
    expect(state().connectOnStart).toBe(false);
    expect(screen.getByTestId("ap-connect-headline")).toHaveTextContent(
      "Not connected",
    );
  });

  it("says what is wrong with the fields before any socket", () => {
    open();
    submit();
    const room = screen.getByTestId("ap-room-input");
    expect(room).toHaveAttribute("aria-invalid", "true");
    expect(room).toHaveAccessibleDescription(/Type the room's address/);
    for (const [text, error] of [
      ["ftp://host", /archipelago\.gg link/],
      ["bad_host", /host name or an IP address/],
      ["host:99999", /1 to 65535/],
      ["host:1/path", /Only a host and a port/],
    ] as const) {
      type("ap-room-input", text);
      expect(room).toHaveAttribute("aria-invalid", "false");
      submit();
      expect(screen.getByTestId("ap-room-error")).toHaveTextContent(error);
    }
    type("ap-room-input", ROOM_ADDRESS);
    submit();
    const slot = screen.getByTestId("ap-slot-input");
    expect(slot).toHaveAttribute("aria-invalid", "true");
    expect(slot).toHaveAccessibleDescription(/Type your slot name/);
    expect(state().active).toBe(false);
  });

  it("turns a room link into its port and a list of its slots", async () => {
    startRoom();
    const fetch = roomStatus({
      last_port: 38281,
      players: [
        ["Link", "A Link to the Past"],
        ["Samus", "Super Metroid"],
      ],
    });
    vi.stubGlobal("fetch", fetch);
    open();
    type("ap-room-input", "https://archipelago.gg/room/AbC");
    fireEvent.blur(screen.getByTestId("ap-room-input"));
    const select = await screen.findByTestId("ap-slot-select");
    expect(fetch).toHaveBeenCalledWith(
      "https://archipelago.gg/api/room_status/AbC",
    );
    expect(select).toHaveDisplayValue("Link · A Link to the Past");
    fireEvent.change(select, { target: { value: "Samus" } });
    submit();
    await vi.waitFor(() => expect(state().active).toBe(true));
    expect(state()).toMatchObject({
      address: "archipelago.gg:38281",
      roomLink: "https://archipelago.gg/room/AbC",
      slot: "Samus",
    });
    // Asked once per link
    fireEvent.blur(screen.getByTestId("ap-room-input"));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("says why a room link gives no address", async () => {
    open();
    const cases: [ReturnType<typeof vi.fn>, RegExp][] = [
      [roomStatus({}, false), /does not know this room/],
      [roomStatus({ players: "?" }), /answered something else/],
      [roomStatus({ last_port: 0, players: [] }), /has not run yet/],
      [
        vi.fn(async () => {
          throw new TypeError("offline");
        }),
        /could not be read/,
      ],
    ];
    for (const [index, [fetch, error]] of cases.entries()) {
      vi.stubGlobal("fetch", fetch);
      type("ap-room-input", `https://archipelago.gg/room/r${index}`);
      submit();
      expect(await screen.findByTestId("ap-room-error")).toHaveTextContent(
        error,
      );
    }
    expect(state().active).toBe(false);
  });

  it("offers Retry now while the session waits, and the room's page when it sleeps", async () => {
    open();
    act(() =>
      useApConnectionStore.setState({
        active: true,
        roomLink: "https://archipelago.gg/room/AbC",
        status: {
          attempt: 3,
          code: "unreachable",
          hint: "room-paused",
          retryInMs: 60_000,
          url: "wss://archipelago.gg:38281",
        },
      }),
    );
    expect(screen.getByTestId("ap-connect-detail")).toHaveTextContent(
      /may be paused/,
    );
    expect(
      screen.getByRole("link", { name: /Open the room's page to wake it/ }),
    ).toHaveAttribute("href", "https://archipelago.gg/room/AbC");
    expect(screen.getByTestId("ap-retry")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("ap-retry"));
    expect(screen.getByTestId("ap-step-reach")).toHaveAttribute(
      "data-state",
      "failing",
    );
    // The failing step opens; another opens on a click
    const toggle = screen.getByRole("button", { name: /Your slot name/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("copies a report that never holds the port", async () => {
    const writeText = vi.fn(async (_text: string) => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    useApConnectionStore.setState({ address: ROOM_ADDRESS });
    open();
    fireEvent.click(screen.getByTestId("ap-copy-report"));
    await vi.waitFor(() =>
      expect(screen.getByText("Copied.")).toBeInTheDocument(),
    );
    const report = writeText.mock.calls[0]?.[0] ?? "";
    expect(report).toContain("127.0.0.1:•••••");
    expect(report).not.toContain("38281");
  });

  it("remembers the password on this device on request", async () => {
    startRoom();
    open();
    type("ap-room-input", ROOM_ADDRESS);
    type("ap-slot-input", "Link");
    type("ap-password-input", "secret");
    fireEvent.click(screen.getByTestId("ap-remember"));
    submit();
    await vi.waitFor(() => expect(state().active).toBe(true));
    expect(localStorage.getItem(AP_PASSWORD_KEY)).toBe("secret");
  });
});

describe("the static check", () => {
  const PUBLIC = { host: "example.com", port: 38281, scheme: "ws" } as const;
  const LAN = { host: "192.168.1.20", port: 38281, scheme: "ws" } as const;

  it("blocks ws:// to the internet from a secure page, with the way out", () => {
    expect(blockedWhy(PUBLIC, { browser: "chromium", kind: "secure" })).toMatch(
      /Ask the room.s host for a wss:\/\/ address, or use the desktop app/,
    );
    expect(blockedWhy(LAN, { browser: "firefox", kind: "secure" })).toMatch(
      /Firefox does not let a secure site reach a ws:\/\/ server on your local network/,
    );
    expect(blockedWhy(PUBLIC, { kind: "desktop" })).toBeNull();
    expect(blockedWhy(LAN, { browser: "chromium", kind: "secure" })).toBeNull();
  });

  it("is said in the dialog before any socket", () => {
    open();
    type("ap-room-input", "ws://example.com:38281");
    type("ap-slot-input", "Link");
    submit();
    // This page is http: nothing to block, so the session starts
    expect(screen.queryByTestId("ap-room-error")).toBeNull();
  });
});
