// R-CLOCK-031: what a browser sends when it agrees, checked before it is kept.
import type { PushSubscriptionJson } from "@japacity/store";

import { fromBase64Url } from "./webpush";

const MAX_ENDPOINT = 1024;

/** RFC 8291: an uncompressed P-256 point and a 16-byte secret. */
const POINT_BYTES = 65;
const AUTH_BYTES = 16;
const UNCOMPRESSED = 4;

function decoded(text: unknown): Uint8Array | null {
  if (typeof text !== "string" || !/^[A-Za-z0-9_-]+=*$/.test(text)) return null;
  try {
    return fromBase64Url(text.replace(/=+$/, ""));
  } catch {
    return null;
  }
}

/**
 * The push services the browsers use: Google's
 * for Chrome and the browsers built on it, Apple's for Safari, Mozilla's for
 * Firefox, Microsoft's for Edge. Each is the host itself or any host under it.
 * The bank-full job posts to the address kept, so nothing else is kept.
 */
export const PUSH_HOSTS: readonly string[] = ["fcm.googleapis.com", "push.apple.com", "push.services.mozilla.com", "notify.windows.com"];

function knownPushHost(host: string): boolean {
  return PUSH_HOSTS.some((known) => host === known || host.endsWith(`.${known}`));
}

/** The endpoint as a known push service's https address on its own port with no user in it, or null. */
export function readEndpoint(value: unknown): string | null {
  if (typeof value !== "string" || value.length > MAX_ENDPOINT) return null;
  try {
    const url = new URL(value);
    const plain = url.protocol === "https:" && url.port === "" && url.username === "" && url.password === "";
    return plain && knownPushHost(url.hostname) ? value : null;
  } catch {
    return null;
  }
}

/** `PushSubscription.toJSON()` with a known push service's endpoint and keys of the right size, or null. Anything else in it is dropped. */
export function readDevice(value: unknown): PushSubscriptionJson | null {
  if (typeof value !== "object" || value === null) return null;
  const { endpoint, keys } = value as { endpoint?: unknown; keys?: unknown };
  const address = readEndpoint(endpoint);
  if (address === null || typeof keys !== "object" || keys === null) return null;
  const { p256dh, auth } = keys as { p256dh?: unknown; auth?: unknown };
  const point = decoded(p256dh);
  const secret = decoded(auth);
  if (point === null || point.length !== POINT_BYTES || point[0] !== UNCOMPRESSED) return null;
  if (secret === null || secret.length !== AUTH_BYTES) return null;
  return { endpoint: address, keys: { p256dh: p256dh as string, auth: auth as string } };
}
