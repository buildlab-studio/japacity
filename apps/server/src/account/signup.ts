// R-ACCOUNT-008, 011, 012, 013, 020, 021, 023: the gate every new user of the
// auth library passes through. It runs as the library's `user.create.before`
// hook, so no sign-in method can make an account without it. An account is
// born only as a guest, through `POST /api/guest` and the anonymous sign-in
// behind it, and the gate writes the account's own row before the library
// writes its user: an account never exists without the row. The only other
// user the library may make is the one a guest's own link makes, which is
// folded into the guest straight after (account/link.ts).
// https://better-auth.com/docs/concepts/database#database-hooks
import type { GenericEndpointContext } from "better-auth";
import { APIError } from "better-auth/api";

import type { ServerDeps } from "../deps";
import { emailIdentity, isBanned } from "../moderation/identities";
import { restrictedUntil } from "../pair/restricted";
import { isOn } from "../switches/switches";
import { PASS_COOKIE, PASS_PREFIX, readCookie } from "./age";
import { signUpCountry } from "./country";
import { guestOf, refuseTaken } from "./link";
import type { Linking } from "./link";
import { nameProblem } from "./username";

function refuse(code: string, message: string): never {
  throw new APIError("FORBIDDEN", { code, message });
}

/** The one thing a refused banned identity is told (R-MODERATION-018). */
const NOT_POSSIBLE = "This sign-in cannot make an account.";

/** The library's path of the anonymous sign-in, reached only through `POST /api/guest`. */
export const GUEST_PATH = "/sign-in/anonymous";

/** The header `POST /api/guest` hands the chosen username to the anonymous sign-in in; never read from a browser's request. */
export const GUEST_NAME_HEADER = "x-japacity-guest-name";

/**
 * R-ACCOUNT-021: the guest's birth. Consumes the browser's age pass (single
 * use: one pass, one account) and stores the row with the username. R-SERVER-031:
 * refused while `signups` is off, so a pass issued before the switch went off
 * makes no account.
 */
async function admitGuest(deps: ServerDeps, endpoint: GenericEndpointContext): Promise<{ data: { id: string; name?: string } }> {
  if (!(await isOn(deps, "signups"))) return refuse("switched-off", "Japacity is full right now. Try again shortly.");
  const headers = endpoint.headers ?? endpoint.request?.headers ?? null;
  const country = signUpCountry(endpoint.request, headers);
  const username = headers?.get(GUEST_NAME_HEADER) ?? null;
  if (username === null || nameProblem(username) !== null) return refuse("not-legal", "Choose a username first.");

  const nonce = readCookie(headers?.get("cookie"), PASS_COOKIE);
  if (nonce === null || nonce === "") return refuse("no-age-pass", "Pass the age screen first.");
  const pass = await endpoint.context.internalAdapter.consumeVerificationValue(PASS_PREFIX + nonce);
  if (pass === null || new Date(pass.expiresAt).getTime() <= deps.now()) return refuse("no-age-pass", "Pass the age screen first.");

  const id = crypto.randomUUID();
  const now = deps.now();
  const created = await deps.stores.account.create({
    id,
    country,
    age: { passed: true, at: Number(pass.value), method: "declared" },
    createdAt: now,
    character: null,
    notifyBankFull: false,
    sendUsageCounts: true,
    state: "guest",
    username,
    usernameChangedAt: null,
    lastPlayedAt: now,
  });
  if (!created.ok) return created.code === "conflict" ? refuse("name-taken", "That username is taken.") : refuse(created.code, created.detail);
  // R-ACCOUNT-020: the library's name column holds nothing; the username lives on the game's row.
  return { data: { id, name: "" } };
}

/**
 * Every user the library makes. A guest's birth, a guest's own link (no row
 * of its own: it is folded into the guest), or nothing: a method that has no
 * account finds none, since an account starts as a guest (R-ACCOUNT-001).
 * R-MODERATION-018: a banned email is refused either way.
 */
export async function admitAccount(deps: ServerDeps, endpoint: GenericEndpointContext | null, linking: Linking, user: { email?: string | null } = {}): Promise<{ data: { id: string; name?: string } }> {
  if (endpoint === null) return refuse("no-account", "An account is made only through the guest start.");
  if (endpoint.path === GUEST_PATH) return admitGuest(deps, endpoint);
  if (typeof user.email === "string" && user.email !== "" && (await isBanned(deps, [emailIdentity(user.email)]))) return refuse("not-possible", NOT_POSSIBLE);
  if ((await guestOf(endpoint)) === null) return refuse("no-account", "No life is saved with this sign-in. Start a new one.");
  const id = crypto.randomUUID();
  linking.add(id);
  return { data: { id } };
}

/**
 * R-MODERATION-018: a sign-in method is refused when its identity
 * (`<provider>:<id>`, such as `google:<sub>`) was banned, whether it makes an
 * account or is linked to one. R-ACCOUNT-023: from a guest, a method may join
 * only the guest's own link. Runs as the library's `account.create.before` hook.
 */
export async function admitMethod(deps: ServerDeps, endpoint: GenericEndpointContext | null, linking: Linking, method: { providerId: string; accountId: string; userId: string }): Promise<void> {
  if (await isBanned(deps, [`${method.providerId}:${method.accountId}`])) refuse("not-possible", NOT_POSSIBLE);
  await refuseTaken(endpoint, method.userId, linking);
}

/**
 * Runs as the library's `session.create.before` hook, so every sign-in method
 * is judged alike. R-MODERATION-014: no sign-in while a suspension runs; the
 * suspension itself ended the sessions the account held. R-ACCOUNT-022: a
 * guest's life is never opened anywhere but where it began, so no method signs
 * in to a guest. R-ACCOUNT-023: from a guest, no sign-in to another account.
 */
export async function admitSession(deps: ServerDeps, endpoint: GenericEndpointContext | null, linking: Linking, session: { userId: string }): Promise<void> {
  if (endpoint?.path !== GUEST_PATH) {
    const user = await endpoint?.context.internalAdapter.findUserById(session.userId);
    if ((user as { isAnonymous?: unknown } | null | undefined)?.isAnonymous === true) refuse("guest-only", "A guest life opens only on the phone that started it. Secure it there to play it here.");
    await refuseTaken(endpoint, session.userId, linking);
  }
  const until = await restrictedUntil(deps, session.userId, "suspend");
  if (until !== null) refuse("not-possible", `This account is suspended until ${new Date(until).toISOString()}.`);
}
