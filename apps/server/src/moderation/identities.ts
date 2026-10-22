// moderation:fixed-admin-actions, moderation:ban-survives-as-hash: a banned account's sign-in identities,
// kept only as salted hashes, and the end of its sessions.
import type { Auth } from "../auth/auth";
import { sha256Hex } from "../auth/hooks";
import type { ServerDeps } from "../dependencies";

/** What a ban needs of the auth library. Tests hand in a stand-in. */
export interface Identities {
  /** The account's sign-in identities: `email:<address>` and `<provider>:<id>` for each linked method. Empty for an unknown account. */
  of: (account: string) => Promise<string[]>;
  endSessions: (account: string) => Promise<void>;
}

export function emailIdentity(email: string): string {
  return `email:${email.trim().toLowerCase()}`;
}

export function authIdentities(auth: Auth): Identities {
  return {
    of: async (account) => {
      const context = await auth.$context;
      const user = await context.internalAdapter.findUserById(account);
      if (user === null) return [];
      const linked = await context.internalAdapter.findAccounts(account);
      return [emailIdentity(user.email), ...linked.map((method) => `${method.providerId}:${method.accountId}`)];
    },
    endSessions: async (account) => {
      const context = await auth.$context;
      await context.internalAdapter.deleteUserSessions(account);
    },
  };
}

export function identityHash(deps: Pick<ServerDeps, "secrets">, identity: string): Promise<string> {
  return sha256Hex(`ban:${deps.secrets.banSalt}:${identity}`);
}

/** moderation:fixed-admin-actions, moderation:ban-survives-as-hash: stores the hash of every identity the account signs in with. */
export async function banIdentities(deps: Pick<ServerDeps, "secrets" | "stores" | "now">, identities: readonly string[]): Promise<void> {
  const hashes = await Promise.all(identities.map((identity) => identityHash(deps, identity)));
  await deps.stores.banned.add(hashes, deps.now());
}

/** moderation:upheld-underage-closes-account, moderation:ban-survives-as-hash: true when any of the identities was banned. For the sign-up gate. */
export async function isBanned(deps: Pick<ServerDeps, "secrets" | "stores">, identities: readonly string[]): Promise<boolean> {
  for (const identity of identities) if (await deps.stores.banned.has(await identityHash(deps, identity))) return true;
  return false;
}
