// The voice, as the maintainer approved it (it is added to docs/rules/text.md): who speaks
// on each surface, and no machine tells anywhere (the design). Every words table is walked:
// content's and the client's. Until the voice has its own rule id these cite R-TEXT-005, the rule that the screen
// says what a person would; R-TEXT-002 where bad news is told straight; R-TEXT-004 where officialdom is deadpan.
import { text, textTables } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { routesUiText } from "../../features/activity/routes.words";
import { adviceUiText } from "../../features/advice/advice.words";
import { cityText } from "../../features/city/city.words";
import { sceneText } from "../../features/city/scene.words";
import { mapText } from "../../features/map/map.words";
import { phoneText } from "../../features/phone/phone.words";
import { roomText } from "../../features/setpiece/room.words";
import { turnText } from "../../features/turn/turn.words";
import { soundText } from "../sound/sound.words";
import { jobsUiText } from "./jobs";
import { uiText } from "./ui";

const clientTables: Record<string, Record<string, string>> = {
  ui: uiText,
  routes: routesUiText,
  advice: adviceUiText,
  city: cityText,
  scene: sceneText,
  map: mapText,
  phone: phoneText,
  room: roomText,
  turn: turnText,
  jobs: jobsUiText,
  sound: soundText,
};

/** Every line a player can read, with the table it is in. */
const every: { table: string; key: string; line: string }[] = [
  ...Object.entries(textTables).flatMap(([table, lines]) => Object.entries(lines).map(([key, line]) => ({ table: `content.${table}`, key, line }))),
  ...Object.entries(clientTables).flatMap(([table, lines]) => Object.entries(lines).map(([key, line]) => ({ table, key, line }))),
];

const found = (pattern: RegExp, keep: (key: string) => boolean = () => true) =>
  every.filter(({ key, line }) => keep(key) && pattern.test(line)).map(({ table, key, line }) => `${table} ${key}: ${line}`);

/** The scam's prize text shouts, and its shout is one of the tells the player learns to read (advice.md R-ADVICE-009). */
const SHOUTS = new Set(["offer.telco-promo.body"]);

/** The report lines: what the results, News's month and the Bank's Lately tell of the month gone. */
const isResult = (key: string) => key.startsWith("line.") || key.startsWith("ui.line.") || key.startsWith("ui.results.");
/** A story's words on News. */
const isNews = (key: string) => key.startsWith("news.") && /\.(head|body)$/.test(key);
/** The nudge: one thing to do, from the chapter's step, a goal or the world. */
const isNudge = (key: string) => key.startsWith("ui.nudge.") || /^chapter\..+\.item\.[^.]+\.(nudge(\..+)?|started|planned(\..+)?|saving|short|blocked)$/.test(key) || /^goal\..+\.first$/.test(key);

describe("the voice: no machine tells anywhere", () => {
  test("[R-TEXT-007] [R-TEXT-005] given the walk, then it reads content's words and every table of the client's", () => {
    expect(every.length).toBeGreaterThan(5000);
    expect(every.filter(({ table }) => table.startsWith("content.")).length).toBe(Object.keys(text).length);
    expect(Object.keys(clientTables)).toEqual(expect.arrayContaining(["ui", "city", "map", "phone", "turn"]));
  });

  test("[R-TEXT-007] [R-TEXT-005] given every line, then none has an em-dash, an en-dash or an exclamation mark, but for the scam's own shout", () => {
    expect(found(/[—–]/)).toEqual([]);
    expect(found(/!/, (key) => !SHOUTS.has(key))).toEqual([]);
  });

  test("[R-TEXT-007] [R-TEXT-005] given every line, then no stock app copy or machine word is in it", () => {
    expect(found(/\b(?:delve|delving|tapestry|testament|vibrant|bustling|realm|embark|elevate|seamless(?:ly)?|unlock|oops|get started|game-changer|navigate the)\b/i)).toEqual([]);
  });

  test("[R-TEXT-007] [R-TEXT-005] given every line, then no sentence mirrors another: not just this but that, it is not this, it is that", () => {
    expect(found(/\bnot (?:just|only|merely)\b[^.]*\bbut\b/i)).toEqual([]);
    expect(found(/\b(?:it|this|that)(?:'s| is) not\b[^.]*[.;,]\s*(?:it|this|that)(?:'s| is)\b/i)).toEqual([]);
  });

  test("[R-TEXT-007] [R-TEXT-005] given every line, then none sums up: no in short, all in all, ultimately, at the end of the day", () => {
    expect(found(/\b(?:in short|all in all|ultimately|in summary|to sum up|at the end of the day|the bottom line|in a nutshell)\b/i)).toEqual([]);
  });
});

describe("the voice: who speaks on each surface", () => {
  test("[R-TEXT-007] [R-TEXT-005] given every story on News, then it is a happening in the world: never you hear, never people are talking, never advice to the player", () => {
    expect(found(/\byou hear\b|\bpeople are talking\b|\beverybody is talking\b|\bword is\b/i, isNews)).toEqual([]);
    expect(found(/(?:^|[.] )(?:Check|Plan|Do not|Don't|Buy|Read on|Make sure|Remember|Keep)\b/, isNews)).toEqual([]);
  });

  test("[R-TEXT-007] [R-TEXT-005] [R-TEXT-002] given every report line, then it tells the month gone in the past tense, plainly, and never what you felt", () => {
    expect(found(/(?:^|[.:;] )You (?:start|leave|look|rest|pass|hear|fly|get|go|ask|reach|send|hand|count|wake|take|buy|sell|pay|move|meet|find|lose|win|turn|see|sit|join|apply|keep|spend|make|change|cook|fetch|play|try|tell|say|stay|carry|share|sign|check|sleep)\b/, isResult)).toEqual([]);
    // The month's happenings that read as now: "the slip comes in", "the bank takes its charge", "the plane lands".
    expect(found(/\b(?:comes (?:in|back|with)|turns you down|offers you|takes its|pays (?:you|off)|says (?:no|yes)|lands:|flies out|goes back|is granted|is refused)\b/, isResult)).toEqual([]);
    expect(found(/\b[Yy]ou are (?:put|invited|taken|told|sent|paid)\b/, isResult)).toEqual([]);
    expect(found(/\byou (?:feel|felt)\b/i, isResult)).toEqual([]);
  });

  test("[R-TEXT-007] [R-TEXT-005] given every nudge, then it is one thing to do in under eight words", () => {
    const words = (line: string) => line.split(/\s+/).filter((word) => word !== "").length;
    const nudges = every.filter(({ key }) => isNudge(key));
    expect(nudges.length).toBeGreaterThan(100);
    expect(nudges.filter(({ line }) => words(line) >= 8).map(({ key, line }) => `${key}: ${line}`)).toEqual([]);
  });
});
