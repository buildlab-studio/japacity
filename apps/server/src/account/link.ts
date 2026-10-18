// account:guest-secures-the-life: securing a guest. The guest signs in with Google or an email
// code from its own session; the auth library makes a user for that method and
// its anonymous plugin calls `onLinkAccount`. Here that new user is folded into
// the guest: its methods and sessions move to the guest's id, it is removed,
// and the guest takes its email and is secured. The game's rows are keyed by
// the guest's id and never move, so nothing of the life can be lost on the way.
// A method that already belongs to an account is refused before it joins or
// signs in to anything, and the guest keeps its life.
// https://better-auth.com/docs/plugins/anonymous
import type { GenericEndpointContext } from "better-auth";
import { APIError, getSessionFromCtx } from "better-auth/api";

import { countSecured } from "../analytics/live";
import type { ServerDeps } from "../deps";

/** The code a refused link answers with, in the library's error and in the Google callback's `?error=`. */
export const METHOD_TAKEN = "method-taken";

/** The users made by a link and not yet folded, by id. One set per auth instance. */
export type Linking = Set<string>;

/** The guest whose session cookie the request carries, or null. */
export async function guestOf(endpoint: GenericEndpointContext | null): Promise<string | null> {
  if (endpoint === null) return null;
  const session = await getSessionFromCtx(endpoint, { disableRefresh: true }).catch(() => null);
  return session !== null && (session.user as { isAnonymous?: unknown }).isAnonymous === true ? session.user.id : null;
}

function taken(): never {
  throw new APIError("FORBIDDEN", { code: METHOD_TAKEN, message: "That sign-in already has a life. This one stays as it is." });
}

/**
 * account:guest-secures-the-life: from a guest's request, a method or a session may only be
 * made for the guest itself or for the user its own link is making. Anything
 * else is an account that exists already: joining it or signing in to it is
 * refused, so neither life changes.
 */
export async function refuseTaken(endpoint: GenericEndpointContext | null, user: string, linking: Linking): Promise<void> {
  const guest = await guestOf(endpoint);
  if (guest === null || guest === user || linking.has(user)) return;
  taken();
}

interface LinkInput {
  anonymousUser: { user: { id: string }; session: { token: string } };
  newUser: { user: { id: string; email: string; emailVerified: boolean } };
  ctx: GenericEndpointContext;
}

/** account:guest-secures-the-life: the anonymous plugin's `onLinkAccount`. The plugin keeps the guest's user (`disableDeleteAnonymousUser`). */
export async function foldIntoGuest(deps: ServerDeps, linking: Linking, { anonymousUser, newUser, ctx }: LinkInput): Promise<void> {
  const guest = anonymousUser.user.id;
  const made = newUser.user.id;
  if (made === guest) return;
  if (!linking.has(made)) taken();
  const internal = ctx.context.internalAdapter;
  for (const method of await internal.findAccounts(made)) await internal.updateAccount(method.id, { userId: guest });
  for (const session of await internal.listSessions(made)) await internal.updateSession(session.token, { userId: guest });
  await internal.deleteUser(made);
  linking.delete(made);
  // The browser now holds the new session's cookie; the guest's own session has no holder left.
  await internal.deleteSession(anonymousUser.session.token);
  await internal.updateUser(guest, { email: newUser.user.email, emailVerified: newUser.user.emailVerified, isAnonymous: false });
  const secured = await deps.stores.account.secure(guest);
  if (!secured.ok) throw new Error(`The guest ${guest} has no account row to secure: ${secured.detail}`);
  // account:social-needs-secured-account, city:board-line-and-ranking: a guest's board rows were written unlisted; secured, its life is on the boards at once.
  await deps.stores.boards.setListed(guest, true);
  // analytics:nightly-game-counters: the guest secured, by region, on the day and on its sign-up day.
  await countSecured(deps, guest);
}
