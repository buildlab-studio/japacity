import type { NewsEntry, NewsStage, RejectionCode } from "@japacity/sim";
import type { Proof, Same } from "@japacity/sim/schemas";
import { describe, expect, test } from "vitest";

import { content, mergeText, text, textTables } from "./index";

declare global {
  interface ImportMeta {
    /** Vite's static import of many files at once. Vitest runs on Vite, so it is there in tests. */
    glob<T>(pattern: string, options: { query: "?raw"; import: "default"; eager: true }): Record<string, T>;
  }
}

/** Every source file of the content package, tests included, as raw text. */
const sources = import.meta.glob<string>("./**/*.ts", { query: "?raw", import: "default", eager: true });

const EM_DASH = "—";
const EN_DASH = "–";

const REJECTION_CODES = [
  "stale",
  "clock-went-back",
  "no-turns",
  "setpiece-open",
  "not-legal",
  "cannot-afford",
  "unknown-id",
  "bad-amount",
  "not-yours",
  "ended",
  "prologue-open",
] as const;

/** Fails to compile if the contract gains or loses a rejection code without this list following. */
export type RejectionCodesListed = Proof<Same<(typeof REJECTION_CODES)[number], RejectionCode>>;

/**
 * The stages a story passes through. A story can end when it has a count of
 * ticks, or when it reverts: the scarcity reverts, and the engine ends it when
 * the float comes into force.
 */
function stagesOf(story: NewsEntry): NewsStage[] {
  const stages: NewsStage[] = [];
  if (story.standIn.rumourLead > 0) stages.push("rumour");
  stages.push("announced", "in-force");
  // An era's story ends with its era (R-DIRECTOR-002).
  if (story.standIn.endsAfter !== null || story.standIn.revert || story.director?.group === "front-page") stages.push("ended");
  return stages;
}

/** The keys among `keys` that have no words. */
function missingWords(keys: string[]): string[] {
  return keys.filter((key) => (text[key] ?? "").trim() === "");
}

describe("words for every entry", () => {
  test("[R-ENGINE-014] given every entry of every kind, when its name is looked up, then there are words for it", () => {
    const ids = [
      ...Object.keys(content.quality),
      ...Object.keys(content.activity),
      ...Object.keys(content.document),
      ...Object.keys(content.school),
      ...Object.keys(content.route),
      ...Object.keys(content.setpiece),
      ...Object.keys(content.obligation),
      ...Object.keys(content.offer),
      ...Object.keys(content.chapter),
      ...Object.keys(content.var),
      ...Object.keys(content.news),
      ...Object.keys(content.scenario),
      ...Object.keys(content.era),
      ...Object.keys(content.points),
    ];
    expect(ids.length).toBeGreaterThan(80);
    expect(missingWords(ids.map((id) => `${id}.name`))).toEqual([]);
  });

  test("[R-ENGINE-014] given every offer, when its words are looked up, then it has a title, a body, every choice and every sign", () => {
    const keys = Object.values(content.offer).flatMap((offer) => [
      `${offer.id}.title`,
      `${offer.id}.body`,
      ...offer.choices.map((choice) => `${offer.id}.choice.${choice.id}`),
      ...offer.signs.map((sign) => `${offer.id}.sign.${sign.key}`),
    ]);
    expect(missingWords(keys)).toEqual([]);
  });

  test("[R-ENGINE-014] given every offer, when its words name a figure in braces, then the offer carries that term", () => {
    const uncarried: string[] = [];
    let named = 0;
    for (const offer of Object.values(content.offer)) {
      const carried = new Set([...Object.keys(offer.terms), ...(offer.id === "offer.job" ? ["job"] : [])]);
      const words = Object.entries(text).filter(([key]) => key.startsWith(`${offer.id}.`));
      for (const [key, line] of words) {
        for (const match of line.matchAll(/\{([^}]+)\}/g)) {
          named += 1;
          if (!carried.has(match[1] ?? "")) uncarried.push(`${key} names ${match[0]}`);
        }
      }
    }
    expect(named).toBeGreaterThan(0);
    expect(uncarried).toEqual([]);
  });

  test("[R-ENGINE-014] given every story, when its words are looked up, then each stage it passes through has a head and a body", () => {
    const keys = Object.values(content.news).flatMap((story) =>
      stagesOf(story).flatMap((stage) => [`${story.id}.${stage}.head`, `${story.id}.${stage}.body`]),
    );
    // news.md's "Words" table has fifteen rows, one for each story at each stage; director.md's pool adds 78
    // stages and its seven eras 21 (announced, in force, ended): 114 rows of a head and a body.
    expect(keys).toHaveLength(228);
    expect(missingWords(keys)).toEqual([]);
  });

  test("[R-ENGINE-014] given every story, when its words are listed, then none is for a stage it never reaches", () => {
    const stages: NewsStage[] = ["rumour", "announced", "in-force", "ended"];
    const stray = Object.values(content.news).flatMap((story) => {
      const reached = stagesOf(story);
      return stages
        .filter((stage) => !reached.includes(stage))
        .flatMap((stage) => [`${story.id}.${stage}.head`, `${story.id}.${stage}.body`])
        .filter((key) => text[key] !== undefined);
    });
    expect(stray).toEqual([]);
  });

  test("[R-ENGINE-014] given every set piece, when its words are looked up, then every question and every answer has words", () => {
    const keys = Object.values(content.setpiece).flatMap((setpiece) =>
      setpiece.questions.flatMap((question) => [
        `${setpiece.id}.q.${question.id}`,
        ...question.answers.map((answer) => `${setpiece.id}.a.${question.id}.${answer.id}`),
      ]),
    );
    expect(missingWords(keys)).toEqual([]);
  });

  test("[R-ENGINE-014] given every chapter, when its words are looked up, then it has a title, an opening, a close and every item", () => {
    const keys = Object.values(content.chapter).flatMap((chapter) => [
      `${chapter.id}.title`,
      `${chapter.id}.open`,
      `${chapter.id}.close`,
      ...chapter.items.map((item) => `${chapter.id}.item.${item.id}`),
    ]);
    expect(missingWords(keys)).toEqual([]);
  });

  test("[R-ENGINE-014] given every route, when its words are looked up, then every checklist item has words", () => {
    const keys = Object.values(content.route).flatMap((route) =>
      route.checklist.map((item) => `${route.id}.item.${item.id}`),
    );
    expect(missingWords(keys)).toEqual([]);
  });

  test("[R-ENGINE-014] given every rejection code in the contract, when its line is looked up, then there are words for it", () => {
    expect(missingWords(REJECTION_CODES.map((code) => `reject.${code}`))).toEqual([]);
  });

  test("[R-ENGINE-014] given every era and every route, when their blurbs are looked up, then there are words for each", () => {
    const keys = [...Object.keys(content.era), ...Object.keys(content.route)].map((id) => `${id}.blurb`);
    expect(missingWords(keys)).toEqual([]);
  });

  test("[R-ENGINE-014] given the road, when the real-story card and the exit are looked up, then their words are there and the credits are separate keys", () => {
    expect(missingWords(["road.real-story.title", "road.real-story.line", "road.exit.title", "road.exit.body"])).toEqual([]);
    const credits = Object.keys(text).filter((key) => key.startsWith("road.real-story.credit."));
    expect(credits.length).toBeGreaterThanOrEqual(2);
    expect(missingWords(credits)).toEqual([]);
  });
});

describe("the words files together", () => {
  test("[R-ENGINE-014] given every words file, when they are merged, then no key is lost to another file", () => {
    const total = Object.values(textTables).reduce((sum, table) => sum + Object.keys(table).length, 0);
    expect(Object.keys(text)).toHaveLength(total);
  });

  test("[R-ENGINE-014] given two words files that share a key, when they are merged, then the merge throws", () => {
    expect(() => mergeText({ one: { "offer.roof.name": "The roof" }, two: { "offer.roof.name": "Roof" } })).toThrow(
      "offer.roof.name",
    );
  });

  test("[R-ENGINE-014] given every words file and the content, when they are searched, then no em-dash or en-dash appears", () => {
    const words = Object.entries(text).filter(([, line]) => line.includes(EM_DASH) || line.includes(EN_DASH));
    expect(words).toEqual([]);
    const data = JSON.stringify(content);
    expect(data.includes(EM_DASH) || data.includes(EN_DASH)).toBe(false);
  });

  test("[R-ENGINE-014] given every source file of the content package, when it is searched, then no em-dash or en-dash appears", () => {
    const files = Object.keys(sources);
    expect(files.length).toBeGreaterThan(25);
    const dashed = files.filter((file) => {
      const source = sources[file] ?? "";
      return source.includes(EM_DASH) || source.includes(EN_DASH);
    });
    expect(dashed).toEqual([]);
  });
});
