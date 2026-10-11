// The journey, not the wait (docs/rules/text.md R-TEXT-007; the design's guideline 9):
// no line narrates the player as waiting, and nothing is said to wait on them. Every words table is walked, content's
// and the client's; a line that says "wait" or its kin fails unless the allow list below names it with its reason.
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
import { moderationText } from "../moderation/moderation.words";
import { soundText } from "../sound/sound.words";
import { jobsUiText } from "./jobs";
import { uiText } from "./ui";

// The admin tables are left out: they are the staff's tool, where a report's age in the queue is a measure, not the game's voice.
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
  moderation: moderationText,
};

const every: { key: string; line: string }[] = [
  ...Object.values(textTables).flatMap((lines) => Object.entries(lines).map(([key, line]) => ({ key, line }))),
  ...Object.values(clientTables).flatMap((lines) => Object.entries(lines).map(([key, line]) => ({ key, line }))),
];

/** "Wait" and its kin, in the words only: a brace's name (`{wait}`, `{patience}`) is a number's slot, never said. */
const WAITING = /\b(?:wait|waits|waited|waiting|awaits?|awaiting|patience|patiently)\b|dead time/i;
const said = (line: string) => line.replace(/\{[^}]*\}/g, "");

/** The lines that keep the word, by key, each with its reason. */
const KEPT: Record<string, string> = {
  "offer.agent-promise.body": "the agent's own words, said in character: \"Just wait.\" is his lie",
  "offer.sponsor-agency.body": "the recruiter's message in quotes, its pressure one of the tells",
  "person.amaka-nurse.drifted": "Amaka's own words, in quotes, when she has given up on you",
  "person.chidi-dubai.drifted": "Chidi's own words, in quotes, when he has given up on you",
  "recurring.landlord.line.5": "the landlord's own words",
  "prologue.strike.answer.wait": "the strike's answer that does nothing, against learning or working: waiting is the act, and the game shows its price (prologue.md R-PROLOGUE table, step 5)",
  "ui.road.wait": "the road's month held at a stop: on the road the act really is waiting, written straight (road.md R-ROAD-006, text.md R-TEXT-002)",
  "news.uk-settle-ten-years.name": "a story on News about a rule abroad: the wait to settle is the rule's own term",
  "news.uk-settle-ten-years.announced.head": "a story on News about a rule abroad: the wait to settle is the rule's own term",
  "news.uk-settle-ten-years.rumour.body": "a story on News about a rule abroad: the wait to settle is the rule's own term",
  "news.uk-settle-ten-years.in-force.body": "a story on News about a rule abroad: the wait to settle is the rule's own term",
};

/** Whole kinds of line that are someone else's words: talk overheard in a place, and the signs painted in the world. */
const KEPT_KINDS: { pattern: RegExp; reason: string }[] = [
  { pattern: /^place\.[^.]+\.overheard\.\d+$/, reason: "a person's words overheard in a place (city.md R-CITY-024)" },
  { pattern: /^place\.[^.]+\.sign\.\d+$/, reason: "a sign painted in the world, a paper speaking" },
  { pattern: /\.art$/, reason: "a card's drawing named by its id (art.waiting-bench), never shown as words" },
];

const kept = (key: string) => key in KEPT || KEPT_KINDS.some(({ pattern }) => pattern.test(key));

describe("the journey, not the wait", () => {
  test("[R-TEXT-007] given every words table, when each line is read, then none says the player waits or that anything waits on them, but for the kept lines", () => {
    expect(every.length).toBeGreaterThan(5000);
    expect(every.filter(({ key, line }) => !kept(key) && WAITING.test(said(line))).map(({ key, line }) => `${key}: ${line}`)).toEqual([]);
  });

  test("[R-TEXT-007] given the allow list, then each kept line still exists, still says the word, and has its reason", () => {
    const all = new Map(every.map(({ key, line }) => [key, line]));
    for (const [key, reason] of Object.entries(KEPT)) {
      expect({ key, reasoned: reason.length > 10, says: WAITING.test(said(all.get(key) ?? "")) }).toEqual({ key, reasoned: true, says: true });
    }
    expect(every.filter(({ key, line }) => KEPT_KINDS.some(({ pattern }) => pattern.test(key)) && WAITING.test(said(line))).length).toBeGreaterThan(0);
  });

  test("[R-TEXT-007] given a new line that narrates waiting, then the scan would catch it; a brace named wait would not", () => {
    for (const line of ["Wait for payday, then the meetup", "A parcel waits", "Still free while you wait", "Mama is waiting for you at home.", "Dead time at home"]) expect({ line, caught: WAITING.test(said(line)) }).toEqual({ line, caught: true });
    for (const line of ["Payday first, then the meetup", "Next page in {wait}", "After {patience} with nothing, {name} moves on."]) expect({ line, caught: WAITING.test(said(line)) }).toEqual({ line, caught: false });
  });

  test("[R-TEXT-007] given the design's table, then the game says the journey's lines: the papers go in and something moves", () => {
    expect(text["activity.get-passport.blurb"]).toBe("You fill the form and pay the fee. The office has it now.");
    expect(text["activity.apply-to-school.blurb"]).toBe("You send your papers to one university. Its answer comes in.");
    expect(text["activity.enter-pool.blurb"]).toBe("Your profile and score go in the pool. Each draw, the cut-off moves.");
    expect(text["chapter.find-your-feet.item.heard.saving"]).toBe("Payday first, then the meetup");
    expect(uiText["ui.offer.title"]).toBe("Asked of you");
  });
});
