// The deployment's content (server:overlays-never-multiply-prices, server:hidden-values-made-once,
// server:public-defaults-run-the-game, server:overlay-change-opens-segment): the public content, with the private overlay
// applied once when the isolate starts, refused whole when `checkOverlay`
// finds a problem.
import { olderContents } from "@japacity/content";
import type { Content, Overlay } from "@japacity/sim";
import { applyOverlay, checkOverlay } from "@japacity/sim";

import type { Contents } from "../deps";

/**
 * server:hidden-values-made-once, server:public-defaults-run-the-game: the contents for an overlay given as JSON, or
 * the public content alone without one. Throws on a refused overlay, so the
 * server does not start on it. Under an overlay the public content is the one
 * before, so a segment run without it replays and opens a new one (server:overlay-change-opens-segment).
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
 * server:older-contents-bundled: the contents with every older content version beside them (`olderContents`, each as it shipped), so a
 * life whose last segment names one replays under it and is upgraded to the current on its first load (server:newer-content-upgrades-state).
 * Under an overlay each older content joins twice, as it shipped and with the overlay applied, so a segment run under
 * either replays. With no older version the contents are returned as they are.
 */
export function withContentBefore(contents: Contents, overlayJson: string | undefined, older: readonly Content[] = olderContents): Contents {
  if (older.length === 0) return contents;
  const overlay = overlayJson === undefined || overlayJson === "" ? null : (JSON.parse(overlayJson) as Overlay);
  // A segment names an overlay only if it applied to that segment's content, so an older content the overlay no longer fits has no such segment.
  const overlaid = overlay === null ? [] : older.filter((each) => checkOverlay(each, overlay).length === 0).map((each) => applyOverlay(each, overlay));
  return { ...contents, older: [...(contents.older ?? []), ...older, ...overlaid] };
}
