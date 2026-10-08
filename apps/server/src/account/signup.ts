// R-ACCOUNT-008, 011, 012, 013, 020: the gate every new account passes
// through. It runs as the auth library's `user.create.before` hook, so no
// sign-in method can make an account without it, and it writes the account's
// own row before the library writes its user: an account never exists
// without the row.
// https://better-auth.com/docs/concepts/database#database-hooks
import type { GenericEndpointContext } from "better-auth";
import { APIError } from "better-auth/api";

import type { ServerDeps } from "../deps";
import { PASS_COOKIE, PASS_PREFIX, readCookie } from "./age";
import { regionOf } from "./region";

function refuse(code: string, message: string): never {
  throw new APIError("FORBIDDEN", { code, message });
}

/**
 * Consumes the browser's age pass (single use: one pass, one account) and
 * stores the account row. Returns the user id the library then uses.
 */
export async function admitAccount(deps: ServerDeps, endpoint: GenericEndpointContext | null): Promise<{ data: { id: string } }> {
  if (endpoint === null) return refuse("no-age-pass", "An account is made only through the sign-up screens.");
  const headers = endpoint.headers ?? endpoint.request?.headers ?? null;
  const { country, policy } = regionOf(deps.config.regions, endpoint.request, headers);
  if (!policy.open) return refuse("region-closed", "Sign-up is not open in this region.");

  const nonce = readCookie(headers?.get("cookie"), PASS_COOKIE);
  if (nonce === null || nonce === "") return refuse("no-age-pass", "Pass the age screen first.");
  const pass = await endpoint.context.internalAdapter.consumeVerificationValue(PASS_PREFIX + nonce);
  if (pass === null || new Date(pass.expiresAt).getTime() <= deps.now()) return refuse("no-age-pass", "Pass the age screen first.");

  const id = crypto.randomUUID();
  const created = await deps.stores.account.create({
    id,
    country,
    age: { passed: true, at: Number(pass.value), method: "declared" },
    createdAt: deps.now(),
    character: null,
  });
  if (!created.ok) return refuse(created.code, created.detail);
  return { data: { id } };
}
