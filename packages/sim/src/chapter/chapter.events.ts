import type { Id } from "../engine/types";

/** Placeholder: the chapter agent defines the real events. */
export type ChapterEvent = { type: "chapter/closed"; chapter: Id<"chapter">; next: Id<"chapter"> | null };
