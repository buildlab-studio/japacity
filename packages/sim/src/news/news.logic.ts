// News: docs/rules/news.md. Stub: nothing delivered yet.
import type { RegisteredKind } from "../engine/kind";
import type { NewsSlice } from "../engine/types";
import type { NewsEvent } from "./news.events";

export const newsKind: RegisteredKind<NewsSlice, NewsEvent> = {
  kind: "news",
  initial: () => ({ delivered: {} }),
  evolve: (slice) => slice,
  view: ({ world }) => ({
    news: world.news.map((story) => ({ id: story.id, stage: story.stage, since: story.since, forYou: false })),
  }),
};
