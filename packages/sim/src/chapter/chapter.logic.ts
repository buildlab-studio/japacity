// Chapters: docs/rules/chapter.md. Stub: the first chapter by order is current (R-CHAPTER-001).
import type { RegisteredKind } from "../engine/kind";
import { requirementsNotBuilt } from "../engine/stub";
import type { ChapterSlice } from "../engine/types";
import type { ChapterEvent } from "./chapter.events";

export const chapterKind: RegisteredKind<ChapterSlice, ChapterEvent> = {
  kind: "chapter",
  initial(_scenario, content) {
    const first = Object.values(content.chapter).sort((a, b) => a.order - b.order)[0];
    return { current: first?.id ?? null, done: [] };
  },
  evolve: (slice) => slice,
  requirements: requirementsNotBuilt(["chapter/done"]),
  invariants(state, content) {
    const problems: string[] = [];
    if (state.chapter.current !== null && content.chapter[state.chapter.current] === undefined) {
      problems.push(`The current chapter ${state.chapter.current} is not in content.`);
    }
    if (state.chapter.current !== null && state.chapter.done.includes(state.chapter.current)) {
      problems.push(`The current chapter ${state.chapter.current} is also done.`);
    }
    return problems;
  },
  view: ({ state, content }) => ({
    chapter: {
      current: state.chapter.current,
      items:
        state.chapter.current === null
          ? []
          : (content.chapter[state.chapter.current]?.items ?? []).map((item) => ({ id: item.id, met: false })),
      done: state.chapter.done,
    },
  }),
};
