// R-CLOCK-031: what a browser sends when it agrees, checked before it is kept.
import type { PushSubscriptionJson } from "@japacity/store";

import { fromBase64Url } from "./webpush";

/** At most this many devices per account, so one account cannot point the job at a crowd of addresses. */
export const MAX_DEVICES = 10;

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

/** The endpoint as a push service's https address, or null. */
export function readEndpoint(value: unknown): string | null {
  if (typeof value !== "string" || value.length > MAX_ENDPOINT) return null;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

/** `PushSubscription.toJSON()` with an https endpoint and keys of the right size, or null. Anything else in it is dropped. */
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
