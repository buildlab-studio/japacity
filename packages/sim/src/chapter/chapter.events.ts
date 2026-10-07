import type { Id } from "../engine/types";

/**
 * The current chapter was finished and is done; `next` is the chapter that
 * opens, or null when it was the last (R-CHAPTER-002, R-CHAPTER-004).
 */
export type ChapterEvent = { type: "chapter/closed"; chapter: Id<"chapter">; next: Id<"chapter"> | null };
