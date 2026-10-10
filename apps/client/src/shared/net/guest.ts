// R-ACCOUNT-022: every `guest-only` refusal, from any route, told to whoever
// listens, so the securing ask opens wherever a guest reached for something a
// secured account may do. The client shows the ask, never a dead end.
import type { ServerRejection } from "./contract";

export type GuestOnlyListener = (refusal: ServerRejection) => void;

const listeners = new Set<GuestOnlyListener>();

/** Listens for `guest-only` refusals; returns the way to stop. */
export function onGuestOnly(listener: GuestOnlyListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Called by the HTTP layer with every body it reads. */
export function heardBody(body: unknown): void {
  if (typeof body !== "object" || body === null) return;
  const refusal = body as Partial<ServerRejection>;
  if (refusal.ok !== false || refusal.code !== "guest-only") return;
  for (const listener of listeners) listener(refusal as ServerRejection);
}
