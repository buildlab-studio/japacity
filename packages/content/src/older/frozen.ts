// server:older-content-frozen: the loader for a frozen content version. `pnpm content:freeze` writes each shipped
// version to `older/<version>/content.json`, exactly as the server bundles it, and lists it in `olderContents` through
// this function. The content is plain data (no function, map, set, class or undefined; the seal's serialization
// refuses any of those), so JSON keeps it whole, its keys in the order the simulation walks them. An entry the live
// tables share comes back as a copy of its own; every golden life replays the same under such a copy. Never edited:
// `pnpm check:version` holds it to the fingerprint beside it, which is what gives it the `Content` type here.
import type { Content } from "@japacity/sim";

/**
 * A frozen version's content, read from its JSON as the `Content` it was frozen from. Marked free of side effects so
 * a bundle that never reads `olderContents` (the client's) drops the frozen data with it; `pnpm check:size` would
 * fail on the bytes if it did not.
 */
/* @__NO_SIDE_EFFECTS__ */
export function frozenContent(json: unknown): Content {
  return json as Content;
}
