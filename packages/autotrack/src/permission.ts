// The browser's local network permission, as far as a page can see it.
// Chromium gates requests from public pages to loopback behind a prompt
// (Local Network Access); the page can query the permission state but not
// tell a refused socket from a closed port. See README "Local network
// access" for the names and their sources.

/** What the page knows of its permission to reach the bridge. */
export interface PermissionState {
  /** The permission name the browser answered to, or null if none. */
  readonly name: string | null;
  readonly state: "granted" | "prompt" | "denied" | "unsupported";
}

export const UNSUPPORTED_PERMISSION: PermissionState = {
  name: null,
  state: "unsupported",
};

export interface LocalNetworkPermission {
  query(): Promise<PermissionState>;
  /** Calls `listener` when the state changes; returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
}

/**
 * Names to query, in order; the first one the browser knows answers.
 * - `loopback-network` gates localhost and 127.0.0.1 in Chrome 145+ and
 *   Firefox 153+ (Chrome 145 release notes; WICG LNA spec §2.6).
 * - `local-network-access` is Chrome 142-144's single permission, kept as an
 *   alias after the split. It is not asked first: from 145 it combines both
 *   permissions and reads "granted" when only the LAN one is granted.
 * `local-network` is never queried: it covers the LAN, not loopback.
 */
export const LOCAL_NETWORK_PERMISSION_NAMES: readonly string[] = [
  "loopback-network",
  "local-network-access",
];

interface PermissionStatusLike {
  readonly state: string;
  onchange: (() => void) | null;
}

interface Permissions {
  query(descriptor: { name: string }): Promise<PermissionStatusLike>;
}

function permissionsOf(host: unknown): Permissions | undefined {
  const navigator = (host as { navigator?: { permissions?: Permissions } })
    .navigator;
  return navigator?.permissions;
}

/**
 * The Permissions API of `host` (globalThis by default). A browser rejects
 * `query` for a name it does not know with a TypeError, so each name is
 * tried in turn; the first that resolves is kept.
 */
export function systemPermission(
  host: unknown = globalThis,
  names: readonly string[] = LOCAL_NETWORK_PERMISSION_NAMES,
): LocalNetworkPermission {
  let status: { name: string; status: PermissionStatusLike } | null = null;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  return {
    async query() {
      const permissions = permissionsOf(host);
      if (permissions === undefined) return UNSUPPORTED_PERMISSION;
      if (status === null) {
        for (const name of names) {
          try {
            status = { name, status: await permissions.query({ name }) };
            break;
          } catch {
            // Unknown to this browser: try the next name.
          }
        }
        if (status === null) return UNSUPPORTED_PERMISSION;
        status.status.onchange = notify;
      }
      const state = status.status.state;
      return {
        name: status.name,
        state:
          state === "granted" || state === "prompt" || state === "denied"
            ? state
            : "unsupported",
      };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
