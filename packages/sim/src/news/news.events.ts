import type { Id, NewsStage } from "../engine/types";

/** Placeholder: the news agent defines the real events. */
export type NewsEvent = { type: "news/delivered"; story: Id<"news">; stage: NewsStage };
