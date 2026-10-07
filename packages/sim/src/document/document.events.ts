import type { Id } from "../engine/types";

/** Placeholder: the document agent defines the real events. */
export type DocumentEvent = { type: "document/issued"; document: Id<"document">; value: number | null };
