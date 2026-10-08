// R-ACCOUNT-008, 011, 012, 013, 020: the gate every new account passes
// through. It runs as the auth library's `user.create.before` hook, so no
// sign-in method can make an account without it, and it writes the account's
// own row before the library writes its user: an account never exists
// without the row.
// https://better-auth.com/docs/concepts/database#database-hooks
import type { GenericEndpointContext } from "better-auth";
import { APIError } from "better-auth/api";

import type { ServerDeps } from "../deps";
import { emailIdentity, isBanned } from "../moderation/identities";
import { restrictedUntil } from "../pair/restricted";
import { isOn } from "../switches/switches";
import { PASS_COOKIE, PASS_PREFIX, readCookie } from "./age";
import { regionOf } from "./region";

function refuse(code: string, message: string): never {
  throw new APIError("FORBIDDEN", { code, message });
}

/** The one thing a refused banned identity is told (R-MODERATION-018). */
const NOT_POSSIBLE = "This sign-in cannot make an account.";

/**
 * Consumes the browser's age pass (single use: one pass, one account) and
 * stores the account row. Returns the user id the library then uses.
 * R-SERVER-031: refused while `signups` is off, so a pass issued before the
 * switch went off makes no account. R-MODERATION-018: refused for a banned email.
 */
export async function admitAccount(deps: ServerDeps, endpoint: GenericEndpointContext | null, user: { email?: string | null } = {}): Promise<{ data: { id: string } }> {
  if (endpoint === null) return refuse("no-age-pass", "An account is made only through the sign-up screens.");
  if (!(await isOn(deps, "signups"))) return refuse("switched-off", "Japacity is full right now. Try again shortly.");
  const headers = endpoint.headers ?? endpoint.request?.headers ?? null;
  const { country, policy } = regionOf(deps.config.regions, endpoint.request, headers);
  if (!policy.open) return refuse("region-closed", "Sign-up is not open in this region.");
  if (typeof user.email === "string" && user.email !== "" && (await isBanned(deps, [emailIdentity(user.email)]))) return refuse("not-possible", NOT_POSSIBLE);

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
    notifyBankFull: false,
    sendUsageCounts: true,
  });
  if (!created.ok) return refuse(created.code, created.detail);
  return { data: { id } };
}

/**
 * R-MODERATION-018: a sign-in method is refused when its identity
 * (`<provider>:<id>`, such as `google:<sub>`) was banned, whether it makes an
 * account or is linked to one. Runs as the library's `account.create.before` hook.
 */
export async function admitMethod(deps: ServerDeps, method: { providerId: string; accountId: string }): Promise<void> {
  if (await isBanned(deps, [`${method.providerId}:${method.accountId}`])) refuse("not-possible", NOT_POSSIBLE);
}

/**
 * R-MODERATION-014: no sign-in while a suspension runs. Runs as the library's
 * `session.create.before` hook, so every sign-in method is refused alike;
 * the suspension itself ended the sessions the account held.
 */
export async function admitSession(deps: ServerDeps, session: { userId: string }): Promise<void> {
  const until = await restrictedUntil(deps, session.userId, "suspend");
  if (until !== null) refuse("not-possible", `This account is suspended until ${new Date(until).toISOString()}.`);
}
