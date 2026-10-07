import type { Id, NewsStage } from "../engine/types";

/** A story was shown at a stage (R-NEWS-004). `forYou` is as it stood when shown (R-NEWS-005). */
export type NewsEvent = { type: "news/delivered"; story: Id<"news">; stage: NewsStage; forYou: boolean };
