import { content, text } from "@japacity/content";
import { fc, test } from "@fast-check/vitest";
import { describe, expect } from "vitest";

import { checkContent } from "../engine/content";
import type { Content, ConversationRow, Id, PairRecord, PhraseEntry, PlayerView } from "../engine/types";
import { start } from "../testing/play";
import { newRecord, writeEvent } from "../pair/pair.logic";
import { phraseChecks } from "./phrase.check";
import { canSay, canSayInPlace, fillOptions, heardBy, saidMoment } from "./phrase.logic";
import type { PlacePolicy, SayPolicy } from "./phrase.logic";

const ADA = "life-ada";
const TUNDE = "life-tunde";
const HOUR = 3_600_000;
const MINUTE = 60_000;
const NOW = 100 * HOUR;
const pair = content.tuning.pair;

/** The shared spots of person:time-together-is-an-act. */
const SHARED_SPOTS = ["beach", "suya-spot", "church", "cinema", "mall", "friends-wedding", "campus", "bus-stop"];
const withSpots: Content = { ...content, people: { spots: SHARED_SPOTS } };
/** Words that pass every check, for planting one bad line among. The real words are checked in content's phrase test. */
const words: Record<string, string> = {
  ...text,
  ...Object.fromEntries(Object.values(content.phrase).map((entry) => [`${entry.id}.name`, entry.fill === null ? "Fine." : `Fine {${entry.fill}}.`])),
  ...Object.fromEntries(Object.values(content.phrase).flatMap((entry) => (entry.options ?? []).map((option) => [`${entry.id}.fill.${option}`, "fine"]))),
  "phrase.meet-at.name": "Let us meet at {spot}.",
};

function phrase(id: Id<"phrase">): PhraseEntry {
  const entry = content.phrase[id];
  if (entry === undefined) throw new Error(`${id} is not in content`);
  return entry;
}

const HELLO = phrase("phrase.hello");
const MEET_AT = phrase("phrase.meet-at");
const EVENING = phrase("phrase.evening");
const GOOD_NEWS = phrase("phrase.good-news");

function connected(): PairRecord {
  return newRecord(ADA, TUNDE, "partner", TUNDE, 1);
}

function policy(change: Partial<SayPolicy> = {}): SayPolicy {
  return { sent: [], now: NOW, tuning: pair, fills: [], ...change };
}

function placePolicy(change: Partial<PlacePolicy> = {}): PlacePolicy {
  return { here: true, sent: [], now: NOW, tuning: pair, fills: [], ...change };
}

/** `count` sends spread inside the last `span` milliseconds. */
function sentWithin(count: number, span: number): number[] {
  return Array.from({ length: count }, (_, index) => NOW - span + 1 + index);
}

describe("the phrases in content", () => {
  test("[pair:preset-phrases-only] given the 23 phrases with the shared spots, when checked, then nothing is found", () => {
    expect(Object.keys(content.phrase)).toHaveLength(23);
    expect(phraseChecks(withSpots)).toEqual([]);
    expect(phraseChecks(withSpots, words)).toEqual([]);
  });

  test("[pair:preset-phrases-only] given every phrase, when its fill-in is read, then events and things list their options and nothing else carries a list", () => {
    const listed = (entry: PhraseEntry): boolean => entry.fill === "event" || entry.fill === "thing";
    const off = Object.values(content.phrase).filter((entry) => (listed(entry) ? (entry.options?.length ?? 0) === 0 : entry.options !== undefined));
    expect(off).toEqual([]);
  });

  test("[pair:preset-phrases-only] given no shared spots, when the phrases are checked, then each spot phrase is found without a source", () => {
    expect(phraseChecks({ ...content, people: { spots: [] } })).toEqual([
      "phrase.meet-at: fills a spot, and there are no spots.",
      "phrase.see-you: fills a spot, and there are no spots.",
    ]);
  });

  test("[pair:preset-phrases-only] given the real content and then no shared spots, when the whole content is checked, then nothing is found and then each spot phrase is named", () => {
    expect(checkContent(content)).toEqual([]);
    expect(checkContent({ ...content, people: { spots: [] } })).toEqual(expect.arrayContaining(["phrase.meet-at: fills a spot, and there are no spots."]));
  });

  test("[pair:preset-phrases-only] given a phrase with an empty list, options it should not have, or a bad key, when checked, then each is found", () => {
    const broken: Content = {
      ...withSpots,
      phrase: {
        ...content.phrase,
        "phrase.good-news": { ...GOOD_NEWS, options: [] },
        "phrase.hello": { ...HELLO, options: ["hi"] },
        "phrase.meet-at": { ...MEET_AT, options: ["beach"] },
        "phrase.Bad": { ...HELLO, id: "phrase.Bad" },
      },
    };
    expect(phraseChecks(broken).join("\n")).toMatch(/phrase\.good-news: fills event from an empty list/);
    expect(phraseChecks(broken).join("\n")).toMatch(/phrase\.hello: has options but no fill-in/);
    expect(phraseChecks(broken).join("\n")).toMatch(/phrase\.meet-at: a spot comes from the shared spots, not options/);
    expect(phraseChecks(broken).join("\n")).toMatch(/the key phrase\.Bad is not a well-formed phrase id/);
  });

  test.each([
    ["Send me money for the fees.", "money"],
    ["What is your phone number?", "phone"],
    ["Bring your passport.", "passport"],
    ["Let us meet in person.", "in person"],
    ["Send a photo.", "photo"],
    ["Add me on WhatsApp.", "whatsapp"],
  ])("[pair:preset-phrases-only] given a phrase that says %s, when checked with its words, then it is found", (said, found) => {
    expect(phraseChecks(withSpots, { ...words, "phrase.hello.name": said }).join("\n")).toContain(`says "${found}"`);
  });

  test("[pair:preset-phrases-only] given words whose fill-in does not match the entry, or a missing option's words, when checked, then each is found", () => {
    const off = { ...words, "phrase.meet-at.name": "Let us meet at {route}.", "phrase.good-news.fill.landed": "" };
    const found = phraseChecks(withSpots, off).join("\n");
    expect(found).toContain("phrase.meet-at: its words hold {route} where the entry fills spot.");
    expect(found).toContain("phrase.good-news: the option landed has no words.");
  });
});

describe("fill-ins", () => {
  test("[pair:preset-phrases-only] given Ada's view, when the fill-ins are asked for, then spots, heard routes, delivered news and options come from their lists only", () => {
    const view = start({ scenario: "scenario.ada", content }).view();
    const routes: PlayerView["routes"] = [
      { ...(view.routes[0] as PlayerView["routes"][number]), id: "route.uk-masters", state: "heard" },
      { ...(view.routes[0] as PlayerView["routes"][number]), id: "route.uk-care", state: "unknown" },
    ];
    const doctored: PlayerView = { ...view, routes, news: [{ id: "news.naira-float", stage: "announced", since: 1, forYou: false }] };
    expect(fillOptions(MEET_AT, withSpots, doctored)).toEqual(SHARED_SPOTS);
    expect(fillOptions(phrase("phrase.looking-at"), withSpots, doctored)).toEqual(["route.uk-masters"]);
    expect(fillOptions(phrase("phrase.did-you-hear"), withSpots, doctored)).toEqual(["news.naira-float"]);
    expect(fillOptions(GOOD_NEWS, withSpots, doctored)).toEqual(["got-job", "visa-came", "passed-test", "landed", "got-papers"]);
    expect(fillOptions(HELLO, withSpots, doctored)).toEqual([]);
    expect(fillOptions(phrase("phrase.looking-at"), withSpots, view)).toEqual(view.routes.filter((route) => route.state !== "unknown").map((route) => route.id));
  });

  test("[pair:preset-phrases-only] given a fill-in off the list, a fill-in where none is wanted, or none where one is, when the phrase is checked, then it is refused", () => {
    const fills = fillOptions(MEET_AT, withSpots, start({ scenario: "scenario.ada", content }).view());
    expect(canSay(connected(), "a", MEET_AT, "my-house", policy({ fills }))).toEqual({ ok: false, failed: "bad-fill" });
    expect(canSay(connected(), "a", MEET_AT, null, policy({ fills }))).toEqual({ ok: false, failed: "bad-fill" });
    expect(canSay(connected(), "a", HELLO, "beach", policy())).toEqual({ ok: false, failed: "bad-fill" });
    expect(canSay(connected(), "a", MEET_AT, "beach", policy({ fills }))).toEqual({ ok: true });
  });
});

describe("a phrase stored in a conversation", () => {
  const row = (entry: PhraseEntry, fill: string | null): ConversationRow => ({ id: "m-1", conversation: connected().id, sender: TUNDE, phrase: entry.id, fill, sentAt: NOW, readAt: null });

  test("[pair:conversation-phrases-stored] given a stored phrase with a spot, when its moment is written from the sender's side, then a said moment holds the phrase and the spot", () => {
    const record = writeEvent(connected(), "b", saidMoment(row(MEET_AT, "beach"), MEET_AT, 4));
    expect(record.moments).toEqual([{ n: 1, by: "b", kind: "said", spot: "beach", what: "phrase.meet-at", tick: 4 }]);
  });

  test("[pair:conversation-phrases-stored] given a stored phrase whose fill-in is not a spot, when its moment is written, then the spot is empty and the sent time stays out", () => {
    const record = writeEvent(connected(), "b", saidMoment(row(GOOD_NEWS, "landed"), GOOD_NEWS, 4));
    expect(record.moments).toEqual([{ n: 1, by: "b", kind: "said", spot: null, what: "phrase.good-news", tick: 4 }]);
    expect(JSON.stringify(record)).not.toContain(String(NOW));
    expect(() => saidMoment(row(HELLO, null), GOOD_NEWS, 4)).toThrow();
  });
});

describe("a phrase said in a place", () => {
  test("[pair:place-phrases-not-stored] given phrases marked for a conversation, a place or both, when said aloud, then only place and both go", () => {
    expect(canSayInPlace(EVENING, null, placePolicy())).toEqual({ ok: true });
    expect(canSayInPlace(HELLO, null, placePolicy())).toEqual({ ok: true });
    expect(canSayInPlace(phrase("phrase.miss-you"), null, placePolicy())).toEqual({ ok: false, failed: "wrong-place" });
    expect(canSay(connected(), "a", EVENING, null, policy())).toEqual({ ok: false, failed: "wrong-place" });
  });

  test("[pair:place-phrases-not-stored] given players in a place, when a phrase is said, then everyone there but the speaker hears it, except a block either way", () => {
    const present = [{ id: ADA }, { id: TUNDE }, { id: "life-zainab" }, { id: "life-ngozi" }, { id: "life-chidi" }];
    const blocks = [{ from: "life-zainab", to: ADA }, { from: ADA, to: "life-chidi" }];
    expect(heardBy(ADA, present, blocks)).toEqual([TUNDE, "life-ngozi"]);
  });
});

describe("the checks before a phrase goes", () => {
  test("[pair:phrase-checks-before-send] given an ended record, when either side sends, then it is not possible", () => {
    const ended = writeEvent(connected(), "b", { type: "pair/ended", absence: false, tick: 3 });
    expect(canSay(ended, "a", HELLO, null, policy())).toEqual({ ok: false, failed: "not-possible" });
    expect(canSay(ended, "b", HELLO, null, policy())).toEqual({ ok: false, failed: "not-possible" });
  });

  test("[pair:phrase-checks-before-send] given the sender at one under the hourly count, at it, and with the oldest send just an hour old, when sending, then only at the count is it refused", () => {
    expect(canSay(connected(), "a", HELLO, null, policy({ sent: sentWithin(pair.phrasesPerHour - 1, HOUR) }))).toEqual({ ok: true });
    expect(canSay(connected(), "a", HELLO, null, policy({ sent: sentWithin(pair.phrasesPerHour, HOUR) }))).toEqual({ ok: false, failed: "too-many" });
    const aged = [NOW - HOUR, ...sentWithin(pair.phrasesPerHour - 1, HOUR)];
    expect(canSay(connected(), "a", HELLO, null, policy({ sent: aged }))).toEqual({ ok: true });
  });

  test("[pair:phrase-checks-before-send] given the sender at one under the count a minute in a place, and at it, when saying, then only at the count is it refused", () => {
    expect(canSayInPlace(HELLO, null, placePolicy({ sent: sentWithin(pair.placePhrasesPerMinute - 1, MINUTE) }))).toEqual({ ok: true });
    expect(canSayInPlace(HELLO, null, placePolicy({ sent: sentWithin(pair.placePhrasesPerMinute, MINUTE) }))).toEqual({ ok: false, failed: "too-many" });
    expect(canSayInPlace(HELLO, null, placePolicy({ here: false }))).toEqual({ ok: false, failed: "not-here" });
  });

  test("[pair:phrase-checks-before-send] given several checks failing at once, when sending, then the first in the page's order is the one reported", () => {
    const ended = writeEvent(connected(), "a", { type: "pair/ended", absence: false, tick: 3 });
    const many = sentWithin(pair.phrasesPerHour, HOUR);
    expect(canSay(ended, "a", HELLO, null, policy({ sent: many }))).toEqual({ ok: false, failed: "not-possible" });
    expect(canSay(connected(), "a", MEET_AT, "my-house", policy({ sent: many }))).toEqual({ ok: false, failed: "too-many" });
  });

  test.prop([fc.array(fc.integer({ min: NOW - 2 * HOUR, max: NOW }), { maxLength: 60 })])(
    "[pair:phrase-checks-before-send] given any send times, when sending, then it is refused for count exactly when the last hour holds the count",
    (sent) => {
      const recent = sent.filter((at) => at > NOW - HOUR).length;
      const result = canSay(connected(), "a", HELLO, null, policy({ sent }));
      expect(result.ok).toBe(recent < pair.phrasesPerHour);
    },
  );
});

describe("a block and the phrases", () => {
  test("[pair:block-ends-every-bond] given a block from either side, when the blocked side sends, then it is not possible, and the blocker learns its own block", () => {
    const blockedByTunde = writeEvent(connected(), "b", { type: "pair/blocked", tick: 3 });
    expect(canSay(blockedByTunde, "a", HELLO, null, policy())).toEqual({ ok: false, failed: "not-possible" });
    expect(canSay(blockedByTunde, "b", HELLO, null, policy())).toEqual({ ok: false, failed: "not-possible" });
    const live = { ...connected(), blocked: { a: false, b: true } };
    expect(canSay(live, "a", HELLO, null, policy())).toEqual({ ok: false, failed: "not-possible" });
    expect(canSay(live, "b", HELLO, null, policy())).toEqual({ ok: false, failed: "blocked" });
  });
});

describe("one way to meet for everyone", () => {
  test("[pair:everyone-meets-by-invite] given two players connected by an invite, when either side sends, then the phrase goes, with nothing about where either plays", () => {
    expect(canSay(connected(), "a", HELLO, null, policy())).toEqual({ ok: true });
    expect(canSay(connected(), "b", HELLO, null, policy())).toEqual({ ok: true });
    expect(Object.keys(policy()).sort()).toEqual(["fills", "now", "sent", "tuning"]);
  });
});
