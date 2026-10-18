import type { Id } from "../engine/types";

/**
 * The current chapter was finished and is done; `next` is the chapter that
 * opens, or null when it was the last (chapter:met-items-close-the-chapter, chapter:no-chapter-after-last).
 * `onGrant`: the route granted or flown whose grant finished it, absent for a
 * close earned by the items (chapter:done-chapter-stays-done).
 */
export type ChapterEvent =
  | { type: "chapter/closed"; chapter: Id<"chapter">; next: Id<"chapter"> | null; onGrant?: Id<"route"> }
  /** The player made this way out the plan the chapters follow (chapter:chapters-follow-lean-route). */
  | { type: "chapter/leaned"; route: Id<"route"> }
  /**
   * The grant these chapters were closed on was withdrawn before the flight: they leave done, and `current`, the
   * first of them by order as it stands in under the lean now, is current again (chapter:done-chapter-stays-done).
   */
  | { type: "chapter/reopened"; chapters: Id<"chapter">[]; current: Id<"chapter"> }
  /** The flight made the closes on the grant final: nothing reopens them (chapter:done-chapter-stays-done). */
  | { type: "chapter/sealed"; chapters: Id<"chapter">[] };
