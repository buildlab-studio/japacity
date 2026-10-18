import type { Id, NewsStage } from "../engine/types";

/** A story was shown at a stage (news:changed-stages-delivered-once). `forYou` is as it stood when shown (news:for-you-when-touching-route). */
export type NewsEvent = { type: "news/delivered"; story: Id<"news">; stage: NewsStage; since: number; forYou: boolean };
