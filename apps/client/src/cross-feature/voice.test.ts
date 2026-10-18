// The voice: who speaks on each surface, and no machine tells anywhere. Every words table is walked:
// content's text and the tables that ride a chunk of their own. Beside text:voice-by-surface these cite text:bands-not-figures, the rule that the screen
// says what a person would; text:bad-news-never-joked where bad news is told straight; text:officialdom-is-deadpan where officialdom is deadpan.
import { text, textTables } from "@japacity/content";
import { uiCalgaryText } from "@japacity/content/ui/calgary";
import { uiCastelText } from "@japacity/content/ui/castel";
import { uiDubaiText } from "@japacity/content/ui/dubai";
import { uiLondonText } from "@japacity/content/ui/london";
import { uiSendOffText } from "@japacity/content/ui/send-off";
import { uiCalgaryMapText, uiCastelMapText, uiDubaiMapText, uiLondonMapText } from "@japacity/content/ui/paper";
import { describe, expect, test } from "vitest";

// The content check on institutions beside wrongdoing (person:no-institution-tied-to-crime), run here over the tables that ride a chunk of their own too.
import { institutionProblems } from "../../../../packages/content/src/person/person.names.check";

/** The tables that ride a chunk of their own, outside content's text: each country's papers and places, and the send-off. */
const chunkTables: Record<string, Record<string, string>> = {
  london: uiLondonMapText,
  londonPlaces: { ...uiLondonText },
  // Calgary's, Dubai's and Castel Volturno's papers and places, each a chunk of its own in the game.
  calgary: uiCalgaryMapText,
  dubai: uiDubaiMapText,
  castel: uiCastelMapText,
  calgaryPlaces: { ...uiCalgaryText },
  dubaiPlaces: { ...uiDubaiText },
  castelPlaces: { ...uiCastelText },
  sendOff: uiSendOffText,
};

/** Every line a player can read, with the table it is in. */
const every: { table: string; key: string; line: string }[] = [
  ...Object.entries(textTables).flatMap(([table, lines]) => Object.entries(lines).map(([key, line]) => ({ table: `content.${table}`, key, line }))),
  ...Object.entries(chunkTables).flatMap(([table, lines]) => Object.entries(lines).map(([key, line]) => ({ table, key, line }))),
];

const found = (pattern: RegExp, keep: (key: string) => boolean = () => true) =>
  every.filter(({ key, line }) => keep(key) && pattern.test(line)).map(({ table, key, line }) => `${table} ${key}: ${line}`);

/** The scam's prize text shouts, and its shout is one of the tells the player learns to read (advice:bad-news-told-straight). */
const SHOUTS = new Set(["offer.telco-promo.body"]);

/** Words said twice on purpose, as people say them: the snack, "now now", "hot hot", "sharp sharp", "inside inside", "quick quick". A comma between ("Enter, enter") is speech too and never matched. */
const SPOKEN_DOUBLES = new Set(["chin", "now", "hot", "sharp", "inside", "quick"]);

/** The report lines: what the results, News's month and the Bank's Lately tell of the month gone. */
const isResult = (key: string) => key.startsWith("line.") || key.startsWith("ui.line.") || key.startsWith("ui.results.");
/** A story's words on News. */
const isNews = (key: string) => key.startsWith("news.") && /\.(head|body)$/.test(key);
/** The nudge: one thing to do, from the chapter's step, a goal or the world. */
const isNudge = (key: string) => key.startsWith("ui.nudge.") || /^chapter\..+\.item\.[^.]+\.(nudge(\..+)?|started|planned(\..+)?|saving|short|blocked)$/.test(key) || /^goal\..+\.first$/.test(key);

describe("the voice: no machine tells anywhere", () => {
  test("[text:voice-by-surface] [text:bands-not-figures] given the walk, then it reads content's words and every table that rides a chunk of its own", () => {
    expect(every.length).toBeGreaterThan(5000);
    expect(every.filter(({ table }) => table.startsWith("content.")).length).toBe(Object.keys(text).length);
    expect(Object.keys(textTables)).toEqual(expect.arrayContaining(["ui", "uiCity", "uiMap", "uiPhone", "uiTurn"]));
  });

  test("[text:voice-by-surface] [text:bands-not-figures] given every line, then none has an em-dash, an en-dash or an exclamation mark, but for the scam's own shout", () => {
    expect(found(/[—–]/)).toEqual([]);
    expect(found(/!/, (key) => !SHOUTS.has(key))).toEqual([]);
  });

  test("[text:voice-by-surface] [text:bands-not-figures] given every line, then no stock app copy or machine word is in it", () => {
    expect(found(/\b(?:delve|delving|tapestry|testament|vibrant|bustling|realm|embark|elevate|seamless(?:ly)?|unlock|oops|get started|game-changer|navigate the)\b/i)).toEqual([]);
  });

  test("[text:voice-by-surface] given every line, then no word stands twice in a row but the doubles people say: chin chin, now now, sharp sharp", () => {
    const doubled = /\b([A-Za-z']+)\s+\1\b/gi;
    const lines = every
      .filter(({ line }) => [...line.matchAll(doubled)].some((match) => !SPOKEN_DOUBLES.has((match[1] ?? "").toLowerCase())))
      .map(({ table, key, line }) => `${table} ${key}: ${line}`);
    expect(lines).toEqual([]);
  });

  test("[text:voice-by-surface] [text:bands-not-figures] given every line, then no sentence mirrors another: not just this but that, it is not this, it is that", () => {
    expect(found(/\bnot (?:just|only|merely)\b[^.]*\bbut\b/i)).toEqual([]);
    expect(found(/\b(?:it|this|that)(?:'s| is) not\b[^.]*[.;,]\s*(?:it|this|that)(?:'s| is)\b/i)).toEqual([]);
  });

  test("[text:voice-by-surface] [text:bands-not-figures] given every line, then none sums up: no in short, all in all, ultimately, at the end of the day", () => {
    expect(found(/\b(?:in short|all in all|ultimately|in summary|to sum up|at the end of the day|the bottom line|in a nutshell)\b/i)).toEqual([]);
  });
});

describe("the voice: who speaks on each surface", () => {
  test("[text:voice-by-surface] [text:bands-not-figures] given every story on News, then it is a happening in the world: never you hear, never people are talking, never advice to the player", () => {
    expect(found(/\byou hear\b|\bpeople are talking\b|\beverybody is talking\b|\bword is\b/i, isNews)).toEqual([]);
    expect(found(/(?:^|[.] )(?:Check|Plan|Do not|Don't|Buy|Read on|Make sure|Remember|Keep)\b/, isNews)).toEqual([]);
  });

  test("[text:voice-by-surface] [text:bands-not-figures] [text:bad-news-never-joked] given every report line, then it tells the month gone in the past tense, plainly, and never what you felt", () => {
    expect(found(/(?:^|[.:;] )You (?:start|leave|look|rest|pass|hear|fly|get|go|ask|reach|send|hand|count|wake|take|buy|sell|pay|move|meet|find|lose|win|turn|see|sit|join|apply|keep|spend|make|change|cook|fetch|play|try|tell|say|stay|carry|share|sign|check|sleep)\b/, isResult)).toEqual([]);
    // The month's happenings that read as now: "the slip comes in", "the bank takes its charge", "the plane lands".
    expect(found(/\b(?:comes (?:in|back|with)|turns you down|offers you|takes its|pays (?:you|off)|says (?:no|yes)|lands:|flies out|goes back|is granted|is refused)\b/, isResult)).toEqual([]);
    expect(found(/\b[Yy]ou are (?:put|invited|taken|told|sent|paid)\b/, isResult)).toEqual([]);
    expect(found(/\byou (?:feel|felt)\b/i, isResult)).toEqual([]);
  });

  test("[text:voice-by-surface] [text:bands-not-figures] given every nudge, then it is one thing to do in under eight words", () => {
    const words = (line: string) => line.split(/\s+/).filter((word) => word !== "").length;
    const nudges = every.filter(({ key }) => isNudge(key));
    expect(nudges.length).toBeGreaterThan(100);
    expect(nudges.filter(({ line }) => words(line) >= 8).map(({ key, line }) => `${key}: ${line}`)).toEqual([]);
  });
});

describe("cultural institutions in every table", () => {
  test("[person:no-institution-tied-to-crime] given every line of content and every table of the client, when an institution is named, then no crime or fraud word stands beside it", () => {
    const lines = Object.fromEntries(every.map(({ table, key, line }) => [`${table} ${key}`, line]));
    expect(Object.keys(lines).length).toBe(every.length);
    expect(institutionProblems(lines)).toEqual([]);
  });
});
