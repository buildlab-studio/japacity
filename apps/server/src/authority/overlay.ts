// The deployment's content (docs/rules/server.md R-SERVER-014, R-SERVER-016,
// R-SERVER-018, R-SERVER-024): the public content, with the private overlay
// applied once when the isolate starts, refused whole when `checkOverlay`
// finds a problem.
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
  // a segment run under an earlier overlay cannot be replayed here; the deployment would need that overlay as the content before.
  return { current: applyOverlay(base, overlay), previous: base };
}
