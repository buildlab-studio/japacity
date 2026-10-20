import type { Command, Content, Id, PlayerView, State } from "@japacity/sim";
import { newState, standInWorld, step, viewFor } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { badNews } from "../comedy/comedy.check";
import { versionedLines } from "../comedy/comedy.data";
import { familyPeople, namePool } from "../person/person.names.data";
import { content as realContent, text } from "../index";
import { chatLines, chatsDue, siblingNames } from "./story.chats.data";
import { chatProblems, nudgeProblems, signalProblems, stepProblems, wordCount } from "./story.check";
import { NUDGE_WORDS, storyStep, storySteps, storyThings } from "./story.data";
import { noticeKey, noticesDue, OBLIGATION_TYPES, reminders, remindersDue } from "./story.notice.data";

/** Decision 0013 lives the living by hand at home; these tests read the charge itself, so they charge it whole. */
const content: Content = { ...realContent, tuning: { ...realContent.tuning, home: { ...realContent.tuning.home, livingByHandBp: 0 } } };

const GRADUATE: Id<"scenario"> = "scenario.graduate";
const WORLD = "world-1";

/** A life and its view, played with the engine's own `step`. */
interface Life {
  state: State;
  tick: number;
}

function begin(scenario: Id<"scenario">): Life {
  return { state: newState(scenario, "seed-1", content), tick: 0 };
}

function viewOf(life: Life, with_: Content = content): PlayerView {
  return viewFor({ state: life.state, world: standInWorld(WORLD, life.tick, with_), content: with_ });
}

function endMonth(life: Life, slots: Extract<Command, { type: "turn/end" }>["slots"]): Life {
  const result = step(life.state, { type: "turn/end", slots, basedOn: life.state.v }, standInWorld(WORLD, life.tick, content), content);
  if (!result.ok) throw new Error(`the month was refused: ${result.code} ${result.detail}`);
  return { state: result.state, tick: life.tick + 1 };
}

/** An act done at once, in the month in hand (activity:now-acts-and-month-acts). */
function actNow(life: Life, activity: Id<"activity">): Life {
  const result = step(life.state, { type: "activity/now", activity, param: null, basedOn: life.state.v }, standInWorld(WORLD, life.tick, content), content);
  if (!result.ok) throw new Error(`the act was refused: ${result.code} ${result.detail}`);
  return { state: result.state, tick: life.tick };
}

const nameOf = (n: number) => text[`person.name.${String(n)}`] ?? "";

describe("the step table", () => {
  test("[world:nudge-says-one-thing] given every chapter in content, when the step table is read, then each item has one row with a place that exists, a thing that place has (or a phone app), and an entry that exists", () => {
    expect(stepProblems(storySteps, storyThings, content, text)).toEqual([]);
    const items = Object.values(content.chapter).flatMap((chapter) => chapter.items.map((item) => `${chapter.id} ${item.id}`));
    expect(storySteps.map((row) => `${row.chapter} ${row.item}`).sort()).toEqual(items.sort());
  });

  test("[world:nudge-says-one-thing] given a copy of the table with a row missing, a place that is not there, a thing the place lacks and an entry that is not there, when it is checked, then each is found", () => {
    const [first, second, third, ...rest] = storySteps;
    const broken = [{ ...second!, place: "place.nowhere" as Id<"place"> }, { ...third!, thing: "jacuzzi" }, { ...rest[0]!, act: { entry: "activity.nothing" } }, ...rest.slice(1)];
    const problems = stepProblems(broken, storyThings, content, text);
    expect(problems).toContain(`${first!.chapter} ${first!.item} has no row`);
    expect(problems.some((problem) => problem.includes("place.nowhere"))).toBe(true);
    expect(problems.some((problem) => problem.includes("jacuzzi"))).toBe(true);
    expect(problems.some((problem) => problem.includes("activity.nothing"))).toBe(true);
  });

  test("[world:nudge-says-one-thing] given every row, when its nudge words are read, then they are one sentence of at most eight words on one line, under the chapter item's own key", () => {
    for (const row of storySteps) {
      expect(row.nudge).toBe(`${row.chapter}.item.${row.item}.nudge`);
      expect(nudgeProblems(row.nudge, text[row.nudge])).toEqual([]);
      expect(wordCount(text[row.nudge] ?? "")).toBeLessThanOrEqual(NUDGE_WORDS);
    }
    expect(text["chapter.find-your-feet.item.job.nudge"]).toBe("Ask at the hub in Yaba");
  });

  test("[world:nudge-says-one-thing] given nudges at the edge, when they are counted, then eight words pass, nine fail, and two sentences or two lines fail", () => {
    expect(nudgeProblems("k", "one two three four five six seven eight")).toEqual([]);
    expect(nudgeProblems("k", "one two three four five six seven eight nine")).toEqual(["k has 9 words"]);
    expect(nudgeProblems("k", "Go home. Sleep")).toEqual(["k is more than one sentence"]);
    expect(nudgeProblems("k", "Go\nhome")).toEqual(["k runs to two lines"]);
    expect(nudgeProblems("k", "Score 6.0 at the test")).toEqual([]);
    expect(nudgeProblems("k", undefined)).toEqual(["k has no words"]);
  });

  test("[world:nudge-says-one-thing] given a new life, when the first chapter's next step is looked up, then its row points at a thing in a built place and its nudge has words", () => {
    const view = viewOf(begin(GRADUATE));
    const next = view.chapter.items.find((item) => !item.met);
    expect(view.chapter.current).toBe("chapter.find-your-feet");
    const row = storyStep(view.chapter.current!, next!.id);
    expect(row).not.toBeNull();
    expect(row!.place in content.place).toBe(true);
    expect((text[row!.nudge] ?? "").trim()).not.toBe("");
  });

  test("[world:phone-holds-what-phones-hold] given the steps that take the file to a desk, when they are read, then each is at a place away from home and the papers box is a thing in the house", () => {
    const fromBox = storySteps.filter((row) => row.fromBox);
    expect(fromBox.map((row) => row.item).sort()).toEqual(["applied", "departed", "english", "tb"]);
    expect(fromBox.every((row) => row.place !== "place.family-house")).toBe(true);
    expect(storyThings["place.family-house"]?.inside).toContain("papers-box");
  });
});

describe("Chats", () => {
  test("[world:phone-holds-what-phones-hold] given every chat line, when it is checked, then it has words, a sender of its thread, events that exist, and preset replies only", () => {
    expect(chatProblems(chatLines, content, text)).toEqual([]);
    expect(chatLines.length).toBeGreaterThanOrEqual(20);
  });

  test("[world:phone-holds-what-phones-hold] given every chat line keyed to a report line, when the line is read, then it is a real line with words", () => {
    const keyed = chatLines.flatMap((line) => line.when.filter((signal) => signal.on === "line").map((signal) => signal.key));
    expect(keyed.length).toBeGreaterThanOrEqual(10);
    expect(keyed.filter((key) => !key.startsWith("line.") || text[key] === undefined)).toEqual([]);
  });

  test("[world:phone-holds-what-phones-hold] given a copy of the lines with a made-up event, a reply that is not a phrase, a place-only phrase and a fill outside its list, when it is checked, then each is found", () => {
    const [line] = chatLines;
    const broken = [
      { ...line!, when: [{ on: "line" as const, key: "line.nothing.happened" }] },
      { ...line!, id: "chats.copy.1" as const, replies: [{ phrase: "phrase.nothing" as Id<"phrase"> }] },
      { ...line!, id: "chats.copy.2" as const, replies: [{ phrase: "phrase.evening" as Id<"phrase"> }] },
      { ...line!, id: "chats.copy.3" as const, replies: [{ phrase: "phrase.good-luck" as Id<"phrase">, fill: "lottery" }] },
      { ...line!, id: "chats.copy.4" as const, replies: [{ phrase: "phrase.looking-at" as Id<"phrase"> }] },
    ];
    const problems = chatProblems(broken, content, text).join("\n");
    expect(problems).toContain("no report line line.nothing.happened");
    expect(problems).toContain("phrase.nothing, which is not a phrase");
    expect(problems).toContain("phrase.evening, which is said only in a place");
    expect(problems).toContain("fills phrase.good-luck with lottery");
    expect(problems).toContain("phrase.looking-at, whose fill-in is the sender's own");
  });

  test("[world:phone-holds-what-phones-hold] given the story's chapters, when the family thread is read, then Mama speaks on the bills, Papa on the papers and the sibling on the kiosk", () => {
    const family = chatLines.filter((line) => line.thread === "family");
    expect(family.some((line) => line.from === "mum" && line.when.some((signal) => signal.on === "offer" && signal.offer === "offer.nepa-bill"))).toBe(true);
    expect(family.some((line) => line.from === "dad" && line.when.some((signal) => signal.on === "activity" && signal.activity === "activity.get-passport"))).toBe(true);
    expect(family.some((line) => line.from === "sibling" && line.when.some((signal) => signal.on === "activity" && signal.activity === "activity.play-lotto"))).toBe(true);
    const chapters = new Set(chatLines.map((line) => line.chapter).filter((chapter) => chapter !== null));
    expect([...chapters].sort()).toEqual(Object.keys(content.chapter).sort());
  });

  test("[world:phone-holds-what-phones-hold] given a chat line keyed to bad news, when its words are read, then they are plain: no line of it takes a joke version and none shouts", () => {
    const keyedToBad = chatLines.filter((line) => line.when.some((signal) => signal.on === "line" && badNews(signal.key, text[signal.key] ?? "")));
    expect(keyedToBad.map((line) => line.id)).toContain("chats.mum.refused");
    for (const line of keyedToBad) {
      expect(Object.keys(versionedLines).filter((versioned) => versioned.startsWith(line.id))).toEqual([]);
      expect(text[`${line.id}.text`]).not.toContain("!");
    }
  });

  test("[world:phone-holds-what-phones-hold] given a new life with no partner, when the chats due are read from its view, then no partner line shows and every line due names the current chapter or none", () => {
    const view = viewOf(begin(GRADUATE));
    const due = chatsDue(view, content);
    expect(due.filter((line) => line.thread === "partner")).toEqual([]);
    expect(due.every((line) => line.chapter === null || line.chapter === view.chapter.current)).toBe(true);
    // The graduate can look for work from the first month, so Mama asks about it.
    expect(due.map((line) => line.id)).toContain("chats.mum.find-work");
  });

  test("[world:phone-holds-what-phones-hold] given a life that starts the passport, when the month ends, then the reminder of the passport's month shows, and Papa's line on the passport that has come waits until it comes", () => {
    const life = begin(GRADUATE);
    expect(remindersDue(viewOf(life), content).some((reminder) => reminder.key === "document.passport.reminder.due")).toBe(false);
    // activity:now-acts-and-month-acts: the passport is asked for at once, then the month ends.
    const after = endMonth(actNow(life, "activity.get-passport"), []);
    const view = viewOf(after);
    const paper = view.documents.find((held) => held.id === "document.passport");
    expect(paper?.state).toBe("pending");
    expect(remindersDue(view, content)).toContainEqual({ key: "document.passport.reminder.due", params: { month: paper!.readyMonth! } });
    expect(chatsDue(view, content).some((line) => line.id === "chats.dad.passport-box")).toBe(false);
  });

  test("[world:phone-holds-what-phones-hold] given a passport on the way, when the month it is issued ends, then Papa's line on keeping it in the box shows that month only", () => {
    // activity:now-acts-and-month-acts: the passport is asked for at once, then the month ends.
    let life = endMonth(actNow(begin(GRADUATE), "activity.get-passport"), []);
    const shown: boolean[] = [];
    for (let month = 0; month < 4 && viewOf(life).documents.find((held) => held.id === "document.passport")?.state !== "held"; month += 1) {
      life = endMonth(life, []);
      shown.push(chatsDue(viewOf(life), content).some((line) => line.id === "chats.dad.passport-box"));
    }
    expect(viewOf(life).documents.find((held) => held.id === "document.passport")?.state).toBe("held");
    expect(shown.at(-1)).toBe(true);
    expect(shown.slice(0, -1).every((was) => !was)).toBe(true);
    life = endMonth(life, []);
    expect(chatsDue(viewOf(life), content).some((line) => line.id === "chats.dad.passport-box")).toBe(false);
  });

  test("[world:phone-holds-what-phones-hold] given a life with siblings and the prologue's life with none yet, when the sibling's lines are read, then they can show only where a sibling fills a slot", () => {
    const withSiblings = viewOf(begin(GRADUATE));
    const prologue = viewOf(begin("scenario.prologue"));
    expect(Object.keys(withSiblings.people.slots).some((slot) => slot.startsWith("sibling-"))).toBe(true);
    expect(chatsDue(prologue, content).filter((line) => line.from === "sibling")).toEqual([]);
    expect(chatLines.filter((line) => line.from === "sibling").every((line) => line.when.some((signal) => signal.on === "sibling"))).toBe(true);
  });

  test("[world:phone-holds-what-phones-hold] given each ready life's sibling, when the name is looked up, then it is a pool name from the family's own people", () => {
    expect(Object.keys(siblingNames).sort()).toEqual(Object.keys(familyPeople).sort());
    for (const [life, name] of Object.entries(siblingNames)) {
      const entry = namePool.find((pooled) => nameOf(pooled.n) === name);
      expect(entry?.people).toBe(familyPeople[life as Id<"scenario">]);
    }
    expect(text["chats.from.sibling"]).toContain("{name}");
    expect(text["chats.from.sibling.plain"]).not.toContain("{");
  });
});

describe("bill notices and reminders", () => {
  test("[world:phone-holds-what-phones-hold] given every obligation type and every type in content, when its notice is looked up, then it has words carrying the bill's amount", () => {
    const inContent = new Set(Object.values(content.obligation).map((entry) => entry.type));
    expect([...inContent].filter((type) => !(OBLIGATION_TYPES as readonly string[]).includes(type))).toEqual([]);
    for (const type of OBLIGATION_TYPES) expect(text[`obligation.notice.${type}`]).toContain("{amount}");
    for (const key of ["obligation.notice.late", "obligation.notice.defaulted"]) {
      expect(text[key]).toContain("{amount}");
      expect(text[key]).toContain("{obligation}");
    }
  });

  test("[world:phone-holds-what-phones-hold] given an obligation due, missed and gone bad, when its notice key is read, then it is the type's notice, the late one and the defaulted one", () => {
    expect(noticeKey("rent", "active", 0)).toBe("obligation.notice.rent");
    expect(noticeKey("rent", "grace", 1)).toBe("obligation.notice.late");
    expect(noticeKey("loan", "defaulted", 2)).toBe("obligation.notice.defaulted");
  });

  test("[world:phone-holds-what-phones-hold] given a new life with its upkeep open, when the notices are read from its view, then each open bill with a charge gives one notice with its entry and its amount as money", () => {
    const view = viewOf(begin(GRADUATE));
    const notices = noticesDue(view, content);
    const charged = view.obligations.filter((open) => open.due > 0);
    expect(charged.length).toBeGreaterThan(0);
    expect(notices).toHaveLength(charged.length);
    for (const [index, open] of charged.entries()) {
      expect(notices[index]?.params.obligation).toBe(open.entry);
      expect(notices[index]?.params.amount).toEqual({ currency: content.obligation[open.entry]!.currency, amount: open.due });
      expect(text[notices[index]!.key]).toBeDefined();
    }
  });

  test("[world:phone-holds-what-phones-hold] given every reminder, when it is checked, then its words exist, its events exist, and a reminder that carries a month says {month}", () => {
    for (const reminder of reminders) {
      const words = text[reminder.key];
      expect(words).toBeDefined();
      expect(reminder.when.flatMap((signal) => signalProblems(signal, content, text))).toEqual([]);
      expect(words!.includes("{month}")).toBe(reminder.month !== null);
    }
    const keys = reminders.map((reminder) => reminder.key);
    expect(keys).toEqual(expect.arrayContaining(["route.uk-masters.reminder.appointment", "route.uk-masters.reminder.decision", "document.english-test.reminder.due"]));
  });
});
