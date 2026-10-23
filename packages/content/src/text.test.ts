import type { NewsEntry, NewsStage, RejectionCode } from "@japacity/sim";
import type { Proof, Same } from "@japacity/sim/schemas";
import { describe, expect, test } from "vitest";

import { content, HOMETOWN_FILL, mergeText, text, textTables, uiBoardsText, uiOnlineText } from "./index";
import { uiAccountSheetText } from "./ui/ui.accountSheet.text";

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
  // An era's story ends with its era (director:one-era-at-a-time).
  if (story.standIn.endsAfter !== null || story.standIn.revert || story.director?.group === "front-page") stages.push("ended");
  return stages;
}

/** The keys among `keys` that have no words. */
function missingWords(keys: string[]): string[] {
  return keys.filter((key) => (text[key] ?? "").trim() === "");
}

describe("words for every entry", () => {
  test("[engine:content-checked-before-play] given every entry of every kind, when its name is looked up, then there are words for it", () => {
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
      ...Object.keys(content.era),
      ...Object.keys(content.points),
    ];
    expect(ids.length).toBeGreaterThan(80);
    expect(missingWords(ids.map((id) => `${id}.name`))).toEqual([]);
    // A ready life has no name of its own (scenario.md): its words are its role, and the life from sixteen's its name.
    const lives = Object.values(content.scenario);
    expect(lives.length).toBeGreaterThan(1);
    expect(missingWords(lives.map((life) => (life.prologue === true ? `${life.id}.name` : `${life.id}.kind`)))).toEqual([]);
    expect(lives.filter((life) => life.prologue !== true && `${life.id}.name` in text).map((life) => life.id)).toEqual([]);
  });

  test("[engine:content-checked-before-play] given every offer, when its words are looked up, then it has a title, a body, every choice and every sign", () => {
    const keys = Object.values(content.offer).flatMap((offer) => [
      `${offer.id}.title`,
      `${offer.id}.body`,
      ...offer.choices.map((choice) => `${offer.id}.choice.${choice.id}`),
      ...offer.signs.map((sign) => `${offer.id}.sign.${sign.key}`),
    ]);
    expect(missingWords(keys)).toEqual([]);
  });

  test("[engine:content-checked-before-play] [prologue:family-draw-on-first-answer] given every offer, when its words name a figure in braces, then the offer carries that term, or it is where the life is from, which the screen fills", () => {
    const uncarried: string[] = [];
    let named = 0;
    for (const offer of Object.values(content.offer)) {
      const carried = new Set([...Object.keys(offer.terms), ...(offer.id === "offer.job" ? ["job"] : []), HOMETOWN_FILL]);
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

  test("[engine:content-checked-before-play] given every story, when its words are looked up, then each stage it passes through has a head and a body", () => {
    const keys = Object.values(content.news).flatMap((story) =>
      stagesOf(story).flatMap((stage) => [`${story.id}.${stage}.head`, `${story.id}.${stage}.body`]),
    );
    // news.md's "Words" table has fifteen rows, one for each story at each stage; director.md's pool adds 78
    // stages and its seven eras 21 (announced, in force, ended): 114 rows of a head and a body.
    // Plus the ended stage of the refusals story and the Canadian draw, which each have an end, and the
    // rumour of the UAE lifting, whose talk runs while the ban's 18 ticks run out: 236. Plus the one-chance story's
    // announced and in-force stages (wallet:cash-pile-warning): 240.
    expect(keys).toHaveLength(240);
    expect(missingWords(keys)).toEqual([]);
  });

  test("[engine:content-checked-before-play] given every story, when its words are listed, then none is for a stage it never reaches", () => {
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

  test("[engine:content-checked-before-play] given every set piece, when its words are looked up, then every question and every answer has words", () => {
    const keys = Object.values(content.setpiece).flatMap((setpiece) =>
      setpiece.questions.flatMap((question) => [
        `${setpiece.id}.q.${question.id}`,
        ...question.answers.map((answer) => `${setpiece.id}.a.${question.id}.${answer.id}`),
      ]),
    );
    expect(missingWords(keys)).toEqual([]);
  });

  test("[engine:content-checked-before-play] given every chapter, when its words are looked up, then it has a title, an opening, a close and every item", () => {
    const keys = Object.values(content.chapter).flatMap((chapter) => [
      `${chapter.id}.title`,
      `${chapter.id}.open`,
      `${chapter.id}.close`,
      ...chapter.items.map((item) => `${chapter.id}.item.${item.id}`),
    ]);
    expect(missingWords(keys)).toEqual([]);
  });

  test("[engine:content-checked-before-play] given every route, when its words are looked up, then every checklist item has words", () => {
    const keys = Object.values(content.route).flatMap((route) =>
      route.checklist.map((item) => `${route.id}.item.${item.id}`),
    );
    expect(missingWords(keys)).toEqual([]);
  });

  test("[engine:content-checked-before-play] given every rejection code in the contract, when its line is looked up, then there are words for it", () => {
    expect(missingWords(REJECTION_CODES.map((code) => `reject.${code}`))).toEqual([]);
  });

  test("[engine:content-checked-before-play] given every era and every route, when their blurbs are looked up, then there are words for each", () => {
    const keys = [...Object.keys(content.era), ...Object.keys(content.route)].map((id) => `${id}.blurb`);
    expect(missingWords(keys)).toEqual([]);
  });

  test("[engine:content-checked-before-play] given the road, when the real-story card and the exit are looked up, then their words are there and the credits are separate keys", () => {
    expect(missingWords(["road.real-story.title", "road.real-story.line", "road.exit.title", "road.exit.body"])).toEqual([]);
    const credits = Object.keys(text).filter((key) => key.startsWith("road.real-story.credit."));
    expect(credits.length).toBeGreaterThanOrEqual(2);
    expect(missingWords(credits)).toEqual([]);
  });
});

describe("the words files together", () => {
  test("[engine:content-checked-before-play] given every words file, when they are merged, then no key is lost to another file", () => {
    const total = Object.values(textTables).reduce((sum, table) => sum + Object.keys(table).length, 0);
    expect(Object.keys(text)).toHaveLength(total);
  });

  test("[engine:content-checked-before-play] given two words files that share a key, when they are merged, then the merge throws", () => {
    expect(() => mergeText({ one: { "offer.roof.name": "The roof" }, two: { "offer.roof.name": "Roof" } })).toThrow(
      "offer.roof.name",
    );
  });

  test("[engine:content-checked-before-play] given every words file and the content, when they are searched, then no em-dash or en-dash appears", () => {
    const words = Object.entries(text).filter(([, line]) => line.includes(EM_DASH) || line.includes(EN_DASH));
    expect(words).toEqual([]);
    const data = JSON.stringify(content);
    expect(data.includes(EM_DASH) || data.includes(EN_DASH)).toBe(false);
  });

  test("[engine:content-checked-before-play] given every source file of the content package, when it is searched, then no em-dash or en-dash appears", () => {
    const files = Object.keys(sources);
    expect(files.length).toBeGreaterThan(25);
    const dashed = files.filter((file) => {
      const source = sources[file] ?? "";
      return source.includes(EM_DASH) || source.includes(EN_DASH);
    });
    expect(dashed).toEqual([]);
  });
});

/**
 * text:account-words-plain: the tables a player reads the account's words in: `uiOnlineText` (the start screen, the ways back
 * in, the account's row, the save sheet, the guest lines and the invite's page), `uiAccountSheetText` (the account's sheet, which rides
 * a chunk of its own) and `uiBoardsText` (the boards).
 */
const ACCOUNT_TABLES = { uiOnlineText, uiAccountSheetText, uiBoardsText };
/** Every line of those tables by its key. */
const ACCOUNT_LINES: Record<string, string> = Object.fromEntries(Object.values(ACCOUNT_TABLES).flatMap((table) => Object.entries(table)));

/** Lines in those tables where keep means another thing than saving a life: the hook's light, the browser's cookies, and two buttons that undo a step. */
const KEEP_MEANS_ANOTHER_THING = new Set([
  // The start screen's hook (text:hook-not-explanation): the light at home, kept on.
  "ui.wink.start.2.b",
  // A browser that holds no cookies, in account:bot-check-on-guest-creation's own words.
  "ui.account.cookies",
  // The answer to "Delete my account": the account stays as it is.
  "ui.account.delete.keep",
  // The answer to removing the last passkey: the passkey stays.
  "ui.account.passkey.last.keep",
]);

describe("the account's words (text:account-words-plain)", () => {
  test("[text:account-words-plain] given the start, sign-in, account, invite and boards words, when each line is read, then none says keep, kept, secure or secured for a life put on an account", () => {
    const said = Object.entries(ACCOUNT_TABLES).flatMap(([table, words]) =>
      Object.entries(words)
        .filter(([key, line]) => !KEEP_MEANS_ANOTHER_THING.has(key) && /\b(keep|keeps|keeping|kept|secure|secures|securing|secured)\b/i.test(line))
        .map(([key, line]) => `${table} ${key}: ${line}`),
    );
    expect(said).toEqual([]);
    // The exceptions are lines that are there, so a renamed key cannot hide a line from the walk.
    for (const key of KEEP_MEANS_ANOTHER_THING) expect(ACCOUNT_LINES[key]).toMatch(/\bkeep(ing)?\b/i);
  });

  test("[text:account-words-plain] given the account's own actions, when they are read, then a guest's life is saved and coming back to it is signing in", () => {
    expect(uiOnlineText["ui.secure.title"]).toBe("Save this life");
    expect(uiOnlineText["ui.secure.code.go"]).toBe("Save");
    expect(uiOnlineText["ui.secure.done.title"]).toBe("Saved");
    expect(uiOnlineText["ui.secure.done"]).toBe("Saved. Sign in on any phone to carry on.");
    expect(uiOnlineText["ui.account.start.returning"]).toBe("Sign in");
    expect(uiOnlineText["ui.account.start.kept.returning"]).toBe("Sign in");
    expect(uiOnlineText["ui.account.start.returning.then"]).toBe("Carry on a saved life");
    expect(uiOnlineText["ui.secure.taken.open"]).toBe("Sign in to my saved life");
  });
});

describe("words that say what happened", () => {
  test("[route:open-set-piece-holds-month] given a set piece open, when the turn is refused, then the words name no one scene: the December visit and the road are set pieces too", () => {
    expect(text["reject.setpiece-open"]).toBeTruthy();
    expect(text["reject.setpiece-open"]?.toLowerCase()).not.toMatch(/interview/);
  });

  test("[chapter:met-items-close-the-chapter] [offer:lapsed-offer-removed] given a chapter opened, an offer taken and an offer lapsed, when their lines are read, then each names the chapter or the offer it is about", () => {
    expect(text["line.chapter.opened"]).toContain("{chapter}");
    expect(text["line.offer.lapsed"]).toContain("{offer}");
    expect(text["line.offer.taken"]).toContain("{offer}");
    expect(text["line.offer.taken"]).not.toMatch(/^Decided/);
  });

  test("[road:pitch-rises-with-pressure] given the man at the park, when his pitch is read, then it does not say the character asked: it comes up to anyone at home", () => {
    expect(text["offer.road-park.body"]?.toLowerCase()).not.toMatch(/heard you asking/);
  });

  test("[abroad-money:arrival-opens-upkeep-and-room] given the upkeep line, when it is read abroad beside the rent, then it does not call itself rent", () => {
    expect(text["line.wallet.upkeep"]?.toLowerCase()).not.toMatch(/rent/);
  });
});
