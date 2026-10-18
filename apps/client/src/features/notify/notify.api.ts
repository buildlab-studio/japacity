// The notice's routes on the server (apps/server/src/routes/notify.ts), and
// the device's side: the browser's permission, its push subscription and the
// day this device last turned the ask down. Both are passed in so tests
// answer for the server and the browser.
// https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission_static
// https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe
import type { NotifyKeyReply, NotifyReply, NotifySettingRequest, PushSubscriptionJson, SubscribeRequest } from "@japacity/api";

import { authorityMode } from "../../shared/net/authorityMode";
import { api, type Fetch } from "../../shared/net/http";
import { pageWall, type WallGuard } from "../../shared/net/wall";

/** The setting, the re-ask wait, and the key to subscribe with (null while the deployment has none). */
export interface NotifyStatus {
  on: boolean;
  reaskDays: number;
  key: string | null;
}

export interface NotifyApi {
  /** Null when the server cannot be reached or no one is signed in. */
  status: () => Promise<NotifyStatus | null>;
  /** Keeps the device on the server and turns the setting on. False when refused. */
  subscribe: (subscription: PushSubscriptionJson) => Promise<boolean>;
  /** The setting off: the server forgets every device. */
  turnOff: () => Promise<boolean>;
}

/** "unsupported": the browser has no notices or no push, as an iPhone may outside the home screen. */
export type Permission = "default" | "granted" | "denied" | "unsupported";

export interface NotifyDevice {
  permission: () => Permission;
  /** Asks the browser; resolves to its answer. */
  requestPermission: () => Promise<Permission>;
  /** Subscribes this browser with the server's key, or null when it cannot. */
  subscribe: (key: string) => Promise<PushSubscriptionJson | null>;
  /** Ends this browser's subscription, if it has one. */
  unsubscribe: () => Promise<void>;
  /** When this device last turned the ask down, in ms since 1970, or null. */
  dismissedAt: () => number | null;
  dismiss: (at: number) => void;
  now: () => number;
}

const NOTIFY = "/api/notify";
const SUBSCRIBE = "/api/notify/subscribe";
const KEY = "/api/notify/key";

/** Every call through the one request function (R-ENGINE-015): its clock, same origin, a wall or no answer sorted by kind. */
export function httpNotifyApi(baseUrl: string, fetch: Fetch = (input, init) => globalThis.fetch(input, init), wall: WallGuard = pageWall): NotifyApi {
  const http = api({ baseUrl, fetch, wall });
  async function call<T extends { ok: true }>(path: string, method: "GET" | "POST" | "PUT", body?: NotifySettingRequest | SubscribeRequest): Promise<T | null> {
    try {
      const read: unknown = method === "GET" ? await http.get(path) : method === "POST" ? await http.post(path, body) : await http.put(path, body);
      return typeof read === "object" && read !== null && (read as { ok?: unknown }).ok === true ? (read as T) : null;
    } catch {
      // No answer of any kind (a wall has already reloaded the page): the setting says it could not be changed.
      return null;
    }
  }
  return {
    async status() {
      const [setting, key] = await Promise.all([call<Extract<NotifyReply, { ok: true }>>(NOTIFY, "GET"), call<NotifyKeyReply>(KEY, "GET")]);
      if (setting === null || key === null) return null;
      return { on: setting.on === true, reaskDays: Number(setting.reaskDays), key: typeof key.key === "string" ? key.key : null };
    },
    subscribe: async (subscription) => (await call(SUBSCRIBE, "POST", { subscription })) !== null,
    turnOff: async () => (await call(NOTIFY, "PUT", { on: false })) !== null,
  };
}

/** The server's notice routes for an online build, or null for the local authority, which never asks. */
export function defaultNotifyApi(): NotifyApi | null {
  const mode = authorityMode();
  return mode.authority === "remote" ? httpNotifyApi(mode.baseUrl) : null;
}

const WORKER = "/notify.sw.js";
const DISMISSED = "japacity.notify.dismissedAt";

function keyBytes(key: string): Uint8Array<ArrayBuffer> {
  const base = key.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base + "=".repeat((4 - (base.length % 4)) % 4)), (char) => char.charCodeAt(0));
}

function supported(): boolean {
  return typeof Notification !== "undefined" && "serviceWorker" in navigator && typeof PushManager !== "undefined";
}

/** The browser this page runs in. */
export function browserDevice(): NotifyDevice {
  return {
    permission: () => (supported() ? Notification.permission : "unsupported"),
    requestPermission: async () => (supported() ? Notification.requestPermission() : "unsupported"),
    async subscribe(key) {
      if (!supported()) return null;
      try {
        const registration = await navigator.serviceWorker.register(WORKER);
        await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
        const json = subscription.toJSON();
        const { p256dh, auth } = json.keys ?? {};
        if (json.endpoint === undefined || p256dh === undefined || auth === undefined) return null;
        return { endpoint: json.endpoint, keys: { p256dh, auth } };
      } catch {
        return null;
      }
    },
    async unsubscribe() {
      if (!supported()) return;
      const registration = await navigator.serviceWorker.getRegistration(WORKER);
      await (await registration?.pushManager.getSubscription())?.unsubscribe();
    },
    dismissedAt() {
      try {
        const stored = Number(localStorage.getItem(DISMISSED));
        return Number.isFinite(stored) && stored > 0 ? stored : null;
      } catch {
        return null;
      }
    },
    dismiss(at) {
      try {
        localStorage.setItem(DISMISSED, String(at));
      } catch {
        // A browser that keeps nothing asks again at the next good moment.
      }
    },
    now: () => Date.now(),
  };
}
