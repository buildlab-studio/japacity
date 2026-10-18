// moderation:admin-view-for-admin-list: the admin's passkey, asked for in place at /admin. The auth library's passkey
// sign-in from the signed-in browser: the server takes only this account's own passkeys, opens a new session from the
// one shown and ends the one it stepped up from. Loaded only with the admin page, so only a listed account fetches it.
// https://better-auth.com/docs/plugins/passkey
import { passkeyClient } from "@better-auth/passkey/client";
import { createAuthClient } from "better-auth/client";

import { pageFetch, requestFetch, type Fetch } from "../../shared/net/http";

/** `other-account`: the passkey shown is another account's (the server's refusal, apps/server/src/auth/hooks.ts). */
export type StepUp = { ok: true } | { ok: false; why: "cancelled" | "other-account" | "unreachable" | "failed" };

/** The codes SimpleWebAuthn and the library give a prompt the person closed or let time out. */
const CANCELLED = new Set(["ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY", "ERROR_CEREMONY_ABORTED", "AUTH_CANCELLED"]);

function clientFor(baseUrl: string, fetch: Fetch) {
  // The library needs a whole address; with no server named (development's local authority) it is this page's own.
  const base = baseUrl.replace(/\/+$/, "") || globalThis.location.origin;
  const send = requestFetch(fetch);
  return createAuthClient({
    baseURL: `${base}/api/auth`,
    fetchOptions: { credentials: "same-origin", customFetchImpl: (input, init) => send(input instanceof Request ? input.url : String(input), init) },
    plugins: [passkeyClient()],
  });
}

export function passkeyStepUp(baseUrl: string, fetch: Fetch = pageFetch): () => Promise<StepUp> {
  let client: ReturnType<typeof clientFor> | null = null;
  return async () => {
    try {
      client ??= clientFor(baseUrl, fetch);
      const { error } = await client.signIn.passkey({ autoFill: false });
      if (error === null) return { ok: true };
      const code = "code" in error ? error.code : "";
      if (code === "other-account") return { ok: false, why: "other-account" };
      return { ok: false, why: CANCELLED.has(code) ? "cancelled" : "failed" };
    } catch {
      return { ok: false, why: "unreachable" };
    }
  };
}
