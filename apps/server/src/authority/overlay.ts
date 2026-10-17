// The deployment's content (docs/rules/server.md R-SERVER-014, R-SERVER-016,
// R-SERVER-018, R-SERVER-024): the public content, with the private overlay
// applied once when the isolate starts, refused whole when `checkOverlay`
// finds a problem.
import { PREVIOUS_CONTENT_VERSION } from "@japacity/content";
import type { Content, Overlay } from "@japacity/sim";
import { applyOverlay, checkOverlay } from "@japacity/sim";

import type { Contents } from "../deps";

/**
 * R-SERVER-016, R-SERVER-018: the contents for an overlay given as JSON, or
 * the public content alone without one. Throws on a refused overlay, so the
 * server does not start on it. Under an overlay the public content is the one
 * before, so a segment run without it replays and opens a new one (R-SERVER-024).
 */
export function contentsFor(base: Content, overlayJson: string | undefined): Contents {
  if (overlayJson === undefined || overlayJson === "") return { current: base, previous: null };
  const overlay = JSON.parse(overlayJson) as Overlay;
  const problems = checkOverlay(base, overlay);
  if (problems.length > 0) throw new Error(`The overlay is refused: ${problems.join(" ")}`);
  // A segment run under an earlier overlay cannot be replayed here; the deployment would need that overlay as the content before.
  return { current: applyOverlay(base, overlay), previous: base };
}

/**
 * R-SERVER-023: the contents with the content version before the public one bundled beside them, so a life whose last
 * segment names it replays under it and is upgraded to the current on its first load (R-SERVER-021). The code holds one
 * content's data, so the one before is that data under the earlier version's name: what changed between the two is
 * carried by `upgradeState` (new slices from `initial`, fields grown inside a slice by the schema raise, ids through
 * the renames). Under an overlay the public content stays the one before the overlaid, and the earlier version joins
 * both: the public one and the overlaid one, so a segment run under either replays.
 */
export function withContentBefore(contents: Contents, base: Content, before: string = PREVIOUS_CONTENT_VERSION): Contents {
  if (before === base.version) return contents;
  const earlier = [{ ...base, version: before }, ...(contents.current === base ? [] : [{ ...contents.current, version: before }])];
  return { ...contents, older: [...(contents.older ?? []), ...earlier] };
}
