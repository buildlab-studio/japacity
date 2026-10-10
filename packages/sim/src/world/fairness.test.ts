import { content, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Content, EraEntry, Id, NewsEntry, Requirement } from "../engine/types";
import { directorFairness } from "./fairness";

const CLOSES: Id<"news"> = "news.uk-study-closes";

/** The real content with one story changed. */
function withStory(id: Id<"news">, change: (story: NewsEntry) => NewsEntry): Content {
  return { ...content, news: { ...content.news, [id]: change(content.news[id]!) } };
}

function withNeeds(needs: Requirement[]): Content {
  return withStory(CLOSES, (story) => ({ ...story, director: { ...story.director!, needs } }));
}

function withEra(id: Id<"era">, change: Partial<EraEntry>): Content {
  return { ...content, era: { ...content.era, [id]: { ...content.era[id]!, ...change } } };
}

describe("fairness", () => {
  test("[R-DIRECTOR-007] given the real content and its words, when fairness is checked, then nothing is found", () => {
    expect(directorFairness(content, text)).toEqual([]);
  });

  test("[R-DIRECTOR-007] given a story whose needs read a character, directly or inside not and any, when checked, then it is found", () => {
    const quality: Requirement = { type: "quality/min", quality: "quality.edu-level", value: 3 };
    expect(directorFairness(withNeeds([quality]))).toHaveLength(1);
    expect(directorFairness(withNeeds([{ type: "any", of: [{ type: "not", of: quality }] }]))).toHaveLength(1);
    expect(directorFairness(withNeeds([{ type: "not", of: { type: "var/max", var: "var.uk-study-window", value: 1 } }]))).toEqual([]);
  });

  test("[R-DIRECTOR-007] given a story carrying something besides the world's variables, when checked, then it is found", () => {
    const effects = withStory(CLOSES, (story) => ({ ...story, effects: [{ type: "document/void", document: "document.passport" }] }) as NewsEntry);
    expect(directorFairness(effects)).toEqual([expect.stringContaining("carries effects")]);
  });

  test("[R-DIRECTOR-007] given a story that names where it is heard, when checked, then nothing is found: a source is words on News and moves nothing", () => {
    const heard = withStory(CLOSES, (story) => ({ ...story, source: { announced: "radio", "in-force": "person" } }));
    expect(directorFairness(heard)).toEqual([]);
  });

  test("[R-DIRECTOR-007] given a story that changes a variable the world lacks or sets a window or strictness out of range, when checked, then each is found", () => {
    const missing = withStory(CLOSES, (story) => ({ ...story, standIn: { ...story.standIn, sets: [{ var: "var.player-cash", value: 0 }] } }));
    expect(directorFairness(missing)).toHaveLength(1);
    const window = withStory(CLOSES, (story) => ({ ...story, standIn: { ...story.standIn, sets: [{ var: "var.uk-study-window", value: 3 }] } }));
    expect(directorFairness(window)).toHaveLength(1);
    const strict = withStory(CLOSES, (story) => ({ ...story, standIn: { ...story.standIn, sets: [{ var: "var.uk-study-strictness", value: 101 }] } }));
    expect(directorFairness(strict)).toHaveLength(1);
    const edge = withStory(CLOSES, (story) => ({ ...story, standIn: { ...story.standIn, sets: [{ var: "var.uk-study-strictness", value: 100 }] } }));
    expect(directorFairness(edge)).toEqual([]);
  });

  test("[R-DIRECTOR-007] given an era with no end, a backwards range, no name or no era to follow it, when checked, then each is found", () => {
    expect(directorFairness(withEra("era.strike", { ticks: [0, 4] }))).toHaveLength(1);
    expect(directorFairness(withEra("era.strike", { ticks: [1, 1] }))).toEqual([]);
    expect(directorFairness(withEra("era.strike", { ticks: [9, 8] }))).toHaveLength(1);
    expect(directorFairness(content, { ...text, "era.strike.name": "" })).toHaveLength(1);
    // Calm is the only era that follows the pandemic; without it the world would stop there.
    expect(directorFairness(withEra("era.calm", { after: {} }))).toEqual([expect.stringContaining("era.pandemic")]);
  });

  test("[R-DIRECTOR-007] given an era followed only by an era that runs once, when checked, then it is found", () => {
    const eras = {
      "era.calm": { ...content.era["era.calm"]!, after: { "era.pandemic": 1 } },
      "era.pandemic": { ...content.era["era.pandemic"]!, after: { "era.calm": 1 } },
    };
    expect(directorFairness({ ...content, era: eras })).toEqual([expect.stringContaining("era.calm")]);
  });
});
