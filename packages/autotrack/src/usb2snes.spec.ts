import { afterEach, describe, expect, it } from "vitest";
import { FakeUsb2Snes, SNI_RETROARCH } from "../test/fake-usb2snes";
import { TransportError } from "./errors";
import { planReads, USB2SNES_LIMITS } from "./plan";
import type { WebSocketLike } from "./platform";
import { deviceKind, Usb2SnesTransport } from "./usb2snes";

let server: FakeUsb2Snes | null = null;
const transports: Usb2SnesTransport[] = [];

async function connect(options: Parameters<typeof FakeUsb2Snes.start>[0] = {}) {
  server = await FakeUsb2Snes.start(options);
  const transport = new Usb2SnesTransport({
    timeouts: { reply: 300 },
    url: server.url,
  });
  transports.push(transport);
  return { bridge: await transport.open(), server, transport };
}

async function until(condition: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !condition(); i++)
    await new Promise((r) => setTimeout(r, 5));
  expect(condition()).toBe(true);
}

afterEach(async () => {
  for (const transport of transports.splice(0)) transport.close();
  await server?.stop();
  server = null;
});

function rejection(promise: Promise<unknown>): Promise<TransportError> {
  return promise.then(
    () => {
      throw new Error("expected a rejection");
    },
    (error: unknown) => {
      expect(error).toBeInstanceOf(TransportError);
      return error as TransportError;
    },
  );
}

describe("deviceKind", () => {
  it.each([
    ["ra://127.0.0.1:55355", "retroarch"],
    ["fxpakpro://./dev/ttyACM0", "fxpakpro"],
    ["fxpakpro://./COM4", "fxpakpro"],
    ["luabridge://127.0.0.1:50996", "luabridge"],
    ["emunwa://127.0.0.1:48879", "emunwa"],
    ["mock://x", "unknown"],
    ["SD2SNES COM3", "fxpakpro"],
    ["RetroArch Localhost", "retroarch"],
    ["Emu - BizHawk", "luabridge"],
    ["SNES Classic", "snes-classic"],
    ["Snes9x - 1.63", "unknown"],
  ] as const)("%s is %s", (id, kind) => {
    expect(deviceKind(id)).toBe(kind);
  });
});

describe("Usb2SnesTransport against a fake bridge", () => {
  it("identifies SNI and names itself", async () => {
    const { bridge, server } = await connect();
    expect(bridge).toEqual({
      kind: "sni",
      url: server.url,
      version: "0.0.103",
    });
    await until(() => server.opcodes().includes("Name"));
    expect(server.requests[1]).toEqual({
      Opcode: "Name",
      Operands: ["alltp-tracker"],
      Space: "SNES",
    });
  });

  it("identifies QUsb2Snes, and an unknown bridge", async () => {
    expect(
      (await connect({ appVersion: "QUsb2Snes-0.7.42" })).bridge,
    ).toMatchObject({
      kind: "qusb2snes",
      version: "0.7.42",
    });
    await server?.stop();
    expect((await connect({ appVersion: "7.42.0" })).bridge).toMatchObject({
      kind: "unknown",
      version: "7.42.0",
    });
  });

  it("lists devices and attaches, reading Info", async () => {
    const { server, transport } = await connect({
      devices: [
        SNI_RETROARCH,
        {
          id: "Snes9x - 1.63",
          info: ["1.63", "NWAccess", "/roms/seed.sfc", "NO_CONTROL_CMD"],
        },
      ],
    });
    const devices = await transport.listDevices();
    expect(devices).toEqual([
      { id: "ra://127.0.0.1:55355", kind: "retroarch" },
      { id: "Snes9x - 1.63", kind: "unknown" },
    ]);
    const info = await transport.attach(devices[1]);
    expect(info).toEqual({
      device: { id: "Snes9x - 1.63", kind: "emunwa" },
      flags: ["NO_CONTROL_CMD"],
      name: "NWAccess",
      rom: "/roms/seed.sfc",
      romReadable: true,
      version: "1.63",
    });
    expect(server.opcodes().slice(-2)).toEqual(["Attach", "Info"]);
  });

  it("turns Info placeholders into facts", async () => {
    const { transport } = await connect({
      devices: [
        {
          id: "ra://127.0.0.1:55355",
          info: ["1.9.0-usb-v9", "SD2SNES", "No Info"],
        },
        {
          id: "RetroArch Localhost",
          info: ["1.22.2", "RetroArch", "seed", "NO_ROM_READ", "NO_ROM_WRITE"],
        },
      ],
    });
    const [ra, qusb] = await transport.listDevices();
    expect((await transport.attach(ra)).rom).toBeNull();
    expect((await transport.attach(qusb)).romReadable).toBe(false);
  });

  it("reads several ranges in one GetAddress, in hex, one request at a time", async () => {
    const { server, transport } = await connect({ chunk: 7 });
    for (let i = 0; i < 0x400; i++) server.memory[0xf5_f000 + i] = i & 0xff;
    server.memory[0x18_0213] = 0x01;
    await transport.attach((await transport.listDevices())[0]);
    const plan = planReads(
      [
        { address: 0xf5_f000, size: 0x300 },
        { address: 0x18_0213, size: 1 },
      ],
      { gap: 0, limits: USB2SNES_LIMITS },
    );
    const into = new Uint8Array(plan.size);
    // Three reads at once: the transport queues them; the bridge never sees two.
    await Promise.all(
      [1, 2, 3].map(() => transport.read(plan.requests[0], into, 0)),
    );
    expect(server.overlapped).toBe(false);
    expect(server.requests.at(-1)).toEqual({
      Opcode: "GetAddress",
      Operands: [
        "180213",
        "1",
        "F5F000",
        "FF",
        "F5F0FF",
        "FF",
        "F5F1FE",
        "FF",
        "F5F2FD",
        "3",
      ],
      Space: "SNES",
    });
    expect(into[0]).toBe(0x01);
    expect(Array.from(into.subarray(1, 6))).toEqual([0, 1, 2, 3, 4]);
    expect(into[0x300]).toBe(0xff);
  });

  it("times out a reply and drops the socket: replies are untagged", async () => {
    const { server, transport } = await connect();
    server.read = "hang";
    const plan = planReads([{ address: 0xf5_0000, size: 1 }], {
      gap: 0,
      limits: USB2SNES_LIMITS,
    });
    const error = await rejection(
      transport.read(plan.requests[0], new Uint8Array(1), 0),
    );
    expect(error).toMatchObject({ code: "timeout", operation: "read" });
    await until(() => server.connections === 0);
    expect((await rejection(transport.listDevices())).code).toBe("closed");
  });

  it("reports a bridge that drops the connection mid-read, and tells its listener", async () => {
    const { server, transport } = await connect();
    const dropped: Error[] = [];
    transport.onClose((error) => dropped.push(error));
    server.read = "drop-mid-read";
    const plan = planReads([{ address: 0xf5_0000, size: 64 }], {
      gap: 0,
      limits: USB2SNES_LIMITS,
    });
    const error = await rejection(
      transport.read(plan.requests[0], new Uint8Array(64), 0),
    );
    expect(error).toMatchObject({
      code: "closed",
      detail: { closeCode: 1006 },
      operation: "read",
    });
    expect(dropped).toEqual([error]);
  });

  it("keeps QUsb2Snes's close reason", async () => {
    const { server, transport } = await connect({
      appVersion: "QUsb2Snes-0.7.42",
    });
    server.read = { closeWith: "Error in device protocol" };
    const plan = planReads([{ address: 0xf5_0000, size: 1 }], {
      gap: 0,
      limits: USB2SNES_LIMITS,
    });
    const error = await rejection(
      transport.read(plan.requests[0], new Uint8Array(1), 0),
    );
    expect(error.detail).toEqual({
      closeCode: 1000,
      reason: "Error in device protocol",
    });
  });

  it("reports an untrusted origin as QUsb2Snes's refusal", async () => {
    server = await FakeUsb2Snes.start({ refuseOrigin: true });
    const transport = new Usb2SnesTransport({ url: server.url });
    transports.push(transport);
    const error = await rejection(transport.open());
    expect(error).toMatchObject({
      code: "closed",
      detail: { closeCode: 1008, reason: "Not in trusted origin" },
    });
  });

  it("reports an unreachable bridge", async () => {
    server = await FakeUsb2Snes.start();
    const url = server.url;
    await server.stop();
    server = null;
    const transport = new Usb2SnesTransport({ url });
    transports.push(transport);
    expect(await rejection(transport.open())).toMatchObject({
      code: "unreachable",
      operation: "open",
    });
  });
});

/** A WebSocket the test drives by hand. */
class HandSocket implements WebSocketLike {
  binaryType = "blob";
  readyState = 0;
  sent: string[] = [];
  closedWith: number | undefined;
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { readonly data: unknown }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onclose:
    | ((event: { readonly code: number; readonly reason: string }) => void)
    | null = null;
  send(data: string): void {
    this.sent.push(data);
  }
  close(code?: number): void {
    this.closedWith = code;
    this.readyState = 3;
  }
  open(): void {
    this.readyState = 1;
    this.onopen?.({});
  }
  receive(data: unknown): void {
    this.onmessage?.({ data });
  }
}

async function handTransport() {
  const socket = new HandSocket();
  const transport = new Usb2SnesTransport({
    socket: () => socket,
    timeouts: { reply: 1000 },
  });
  const opening = transport.open();
  expect(socket.binaryType).toBe("arraybuffer");
  socket.open();
  await Promise.resolve();
  socket.receive(JSON.stringify({ Results: ["SNI-0.0.103"] }));
  await opening;
  return { socket, transport };
}

describe("Usb2SnesTransport protocol errors", () => {
  const plan = planReads([{ address: 0xf5_0000, size: 4 }], {
    gap: 0,
    limits: USB2SNES_LIMITS,
  });

  it("refuses more bytes than requested", async () => {
    const { socket, transport } = await handTransport();
    const reading = rejection(
      transport.read(plan.requests[0], new Uint8Array(4), 0),
    );
    socket.receive(new ArrayBuffer(5));
    expect(await reading).toMatchObject({ code: "protocol" });
    expect(socket.closedWith).toBe(1000);
  });

  it("refuses text where bytes were expected, and malformed JSON", async () => {
    const first = await handTransport();
    const reading = rejection(
      first.transport.read(plan.requests[0], new Uint8Array(4), 0),
    );
    first.socket.receive("{}");
    expect(await reading).toMatchObject({ code: "protocol" });

    const second = await handTransport();
    const listing = rejection(second.transport.listDevices());
    second.socket.receive("not json");
    expect(await listing).toMatchObject({
      code: "protocol",
      operation: "device-list",
    });
  });

  it("refuses a message nobody asked for", async () => {
    const { socket, transport } = await handTransport();
    const dropped: Error[] = [];
    transport.onClose((error) => dropped.push(error));
    socket.receive(new ArrayBuffer(1));
    expect(dropped[0]).toMatchObject({ code: "protocol" });
  });

  it("rejects what is pending on close(), and closes once", async () => {
    const { socket, transport } = await handTransport();
    const reading = rejection(
      transport.read(plan.requests[0], new Uint8Array(4), 0),
    );
    transport.close();
    transport.close();
    expect(await reading).toMatchObject({ code: "closed" });
    expect(socket.closedWith).toBe(1000);
  });

  it("gives up on a socket that never opens, and closes it", async () => {
    const socket = new HandSocket();
    const transport = new Usb2SnesTransport({
      socket: () => socket,
      timeouts: { open: 20 },
    });
    expect(await rejection(transport.open())).toMatchObject({
      code: "unreachable",
      detail: { reason: "timeout" },
    });
    expect(socket.closedWith).toBe(1000);
  });

  it("rejects a pending open when closed", async () => {
    const socket = new HandSocket();
    const transport = new Usb2SnesTransport({ socket: () => socket });
    const opening = rejection(transport.open());
    transport.close();
    expect(await opening).toMatchObject({ code: "closed", operation: "open" });
  });

  it("reports a socket that closes before opening as unreachable", async () => {
    const socket = new HandSocket();
    const transport = new Usb2SnesTransport({ socket: () => socket });
    const opening = rejection(transport.open());
    socket.onclose?.({ code: 1006, reason: "" });
    expect(await opening).toMatchObject({
      code: "unreachable",
      detail: { closeCode: 1006 },
    });
  });

  it("reports a socket that only errors before opening as unreachable", async () => {
    // Node 22's WebSocket fires "error" and never "close" on a refused port
    const socket = new HandSocket();
    const transport = new Usb2SnesTransport({ socket: () => socket });
    const opening = rejection(transport.open());
    socket.onerror?.({});
    expect(await opening).toMatchObject({
      code: "unreachable",
      detail: { reason: "error" },
    });
    expect(socket.closedWith).toBe(1000);
  });

  it("fails to open without a WebSocket", async () => {
    const transport = new Usb2SnesTransport({
      socket: () => {
        throw new Error("no WebSocket here");
      },
    });
    expect(await rejection(transport.open())).toMatchObject({
      code: "unreachable",
      detail: { reason: "Error: no WebSocket here" },
    });
  });
});
