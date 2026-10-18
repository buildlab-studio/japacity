// account:social-needs-secured-account: every `guest-only` refusal, from any route, told to whoever
// listens, so the securing ask opens wherever a guest reached for something a
// secured account may do. The client shows the ask, never a dead end.
import type { ServerRejection } from "@japacity/api";

import { listeners } from "../listeners/listeners";

export type GuestOnlyListener = (refusal: ServerRejection) => void;

const guestOnly = listeners<[refusal: ServerRejection]>();

/** Listens for `guest-only` refusals; returns the way to stop. */
export const onGuestOnly: (listener: GuestOnlyListener) => () => void = guestOnly.subscribe;

/** Called by the HTTP layer with every body it reads. */
export function heardBody(body: unknown): void {
  if (typeof body !== "object" || body === null) return;
  const refusal = body as Partial<ServerRejection>;
  if (refusal.ok !== false || refusal.code !== "guest-only") return;
  guestOnly.notify(refusal as ServerRejection);
}
