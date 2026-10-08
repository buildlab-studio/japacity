// The admin view's ports as the app builds them: the pair side's report store
// and, when the server runs with the auth library, its identities.
import type { Accounts } from "../auth/auth";
import type { ServerDeps } from "../deps";
import type { ModerationPorts } from "./decide";
import { authIdentities } from "./identities";
import { memoryReportQueue } from "./reports";

/** until the pair side's `ModerationStore` merges, the queue reads this empty stand-in; then it reads `deps.stores.moderation`. */
const unmerged = memoryReportQueue();

export function moderationPorts(_deps: ServerDeps, accounts: Accounts | undefined): ModerationPorts {
  return { reports: unmerged, identities: accounts === undefined ? null : authIdentities(accounts.auth) };
}
