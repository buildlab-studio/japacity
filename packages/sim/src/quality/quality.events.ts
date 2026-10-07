import type { Id } from "../engine/types";

/** Placeholder: the quality work defines the real events. */
export type QualityEvent = { type: "quality/changed"; quality: Id<"quality">; amount: number; source: string };
