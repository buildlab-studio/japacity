// The stage's size and cursor for each frame of the teaser, and which design a stage draws: the laptop's when it has
// the room, the phone's when its container is a phone's column (its compact design), as the kit's Stage picks it.
import type { Layout } from "./kit";
import { FRAME, type Shape } from "./host";

/** Below this container width the laptop's stage draws the phone's design instead, at the phone's size. */
const COMPACT_BELOW = 1000;

/** The Stage's size, compact design and cursor for a frame: a laptop's arrow, or a finger on the phone. */
export function stageFrame(shape: Shape) {
  const phone = { x: 270, y: 760 };
  if (shape === "tall") return { width: FRAME.tall.width, height: FRAME.tall.height, cursor: { at: phone, style: "touch" as const } };
  return {
    width: FRAME.wide.width,
    height: FRAME.wide.height,
    compact: { below: COMPACT_BELOW, width: FRAME.tall.width, height: FRAME.tall.height },
    // The arrow waits past the stage's right edge and comes in to its first press.
    cursor: { at: { wide: { x: 1340, y: 600 }, compact: phone }, style: "real" as const },
  };
}

/** The design a stage draws: the phone's in a laptop stage laid out compact. */
export function shown(shape: Shape, layout: Layout): Shape {
  return layout === "compact" ? "tall" : shape;
}
