import { describe, expect, it } from "vitest";
import { systemPermission } from "./permission";

/** A Permissions API that knows `names`, like a browser's enum. */
function host(names: Record<string, string>) {
  const statuses: {
    name: string;
    status: { state: string; onchange: (() => void) | null };
  }[] = [];
  const queried: string[] = [];
  const permissions = {
    query({ name }: { name: string }) {
      queried.push(name);
      if (!(name in names))
        return Promise.reject(
          new TypeError(`'${name}' is not a valid PermissionName`),
        );
      const status = { onchange: null, state: names[name] };
      statuses.push({ name, status });
      return Promise.resolve(status);
    },
  };
  return { host: { navigator: { permissions } }, queried, statuses };
}

describe("systemPermission", () => {
  it("asks loopback-network first (Chrome 145+, Firefox 153+)", async () => {
    const fake = host({
      "local-network-access": "granted",
      "loopback-network": "prompt",
    });
    expect(await systemPermission(fake.host).query()).toEqual({
      name: "loopback-network",
      state: "prompt",
    });
    expect(fake.queried).toEqual(["loopback-network"]);
  });

  it("falls back to Chrome 142-144's local-network-access", async () => {
    const fake = host({ "local-network-access": "denied" });
    expect(await systemPermission(fake.host).query()).toEqual({
      name: "local-network-access",
      state: "denied",
    });
    expect(fake.queried).toEqual(["loopback-network", "local-network-access"]);
  });

  it("says unsupported where no name is known (Safari) or there is no API", async () => {
    expect(await systemPermission(host({}).host).query()).toEqual({
      name: null,
      state: "unsupported",
    });
    expect(await systemPermission({}).query()).toEqual({
      name: null,
      state: "unsupported",
    });
  });

  it("queries once, then reads the live state and reports changes", async () => {
    const fake = host({ "loopback-network": "prompt" });
    const permission = systemPermission(fake.host);
    let changes = 0;
    const unsubscribe = permission.subscribe(() => changes++);
    await permission.query();
    fake.statuses[0].status.state = "granted";
    fake.statuses[0].status.onchange?.();
    expect(await permission.query()).toEqual({
      name: "loopback-network",
      state: "granted",
    });
    expect(fake.queried).toHaveLength(1);
    expect(changes).toBe(1);
    unsubscribe();
    fake.statuses[0].status.onchange?.();
    expect(changes).toBe(1);
    fake.statuses[0].status.state = "weird";
    expect((await permission.query()).state).toBe("unsupported");
  });
});
