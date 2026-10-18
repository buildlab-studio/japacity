// The brief, its chip and its marker, read from the view (docs/design/13-the-lively-layer.md section 4): the giver
// and the things with their places, the dots, the toast, and the fun the road never touches.
import { content, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { engineView } from "../../../shared/testing/fixtures";
import { say } from "../../../shared/words/text";
import { livelyText } from "../../../shared/words/tables/lively.words";
import { baseOf, briefDots, briefOf, doneToast, FUN_ACTS, itemPlace, itemsDone, markerAllowed, nextBase } from "./brief";

describe("the brief", () => {
  test("[R-WORLD-003] [R-CHAPTER-011] given the first chapter, when its brief is read, then it is handed by a person at the hub in their words, with a title of a wink, each thing of the chapter with its place, the first not in lit as now, the rewards and the next brief", () => {
    const view = engineView();
    const brief = briefOf(view, "Service year is over.");
    if (brief === null) throw new Error("No brief");
    expect(brief.giver).toEqual({ name: say("chapter.find-your-feet.brief.giver"), where: say("chapter.find-your-feet.brief.giver.where") });
    expect(brief.line).toBe("Service year is over.");
    expect(brief.title).toBe(say("chapter.find-your-feet.brief.title"));
    // Never the chapter's name as a heading, at most three words.
    expect(brief.title).not.toBe("Find your feet");
    expect(brief.title.split(/\s+/).length).toBeLessThanOrEqual(3);
    expect(brief.items.map((item) => item.id)).toEqual(view.chapter.items.map((item) => item.id));
    expect(brief.items.filter((item) => item.now).map((item) => item.id)).toEqual([view.chapter.items.find((item) => !item.met)?.id]);
    expect(brief.items.find((item) => item.id === "job")?.place).toBe("The hub");
    expect(brief.items.find((item) => item.id === "pay")?.place).toBe("Your job");
    expect(brief.rewards.map((reward) => reward.words)).toEqual([say("chapter.find-your-feet.brief.reward.1"), say("chapter.find-your-feet.brief.reward.2")]);
    expect(brief.next?.title).toBe(say("chapter.build-the-file.brief.title"));
  });

  test("[R-WORLD-003] [R-CHAPTER-011] given every chapter that is not a variant, when its brief's words are looked up, then content holds its title, its giver and where they stand, keyed by the chapter, and the client's own table holds none of them", () => {
    for (const chapter of Object.values(content.chapter).filter((entry) => entry.variantOf === undefined)) {
      for (const key of [`${chapter.id}.brief.title`, `${chapter.id}.brief.giver`, `${chapter.id}.brief.giver.where`]) expect({ key, words: (text[key] ?? "").length > 0 }).toEqual({ key, words: true });
      expect(briefOf({ chapter: { current: chapter.id, items: [], done: [], closes: false, next: null } }, "")?.title).toBe(text[`${chapter.id}.brief.title`]);
    }
    expect(Object.keys(livelyText).filter((key) => /^ui\.brief\.(giver|at\.|toast\.|count\.)/.test(key) || Object.keys(content.chapter).some((id) => key.startsWith(`ui.brief.${id.replace(/^chapter\./, "")}.`)))).toEqual([]);
  });

  test("[R-WORLD-003] given a place under each thing, when the places are read, then each is at most two words: the stop, the phone or the month", () => {
    for (const chapter of Object.values(content.chapter)) {
      for (const item of chapter.items) expect(itemPlace(chapter.id, item.id).split(/\s+/).length, `${chapter.id}.${item.id}`).toBeLessThanOrEqual(2);
    }
    expect(itemPlace("chapter.build-the-file", "transcript")).toBe(say("chapter.brief.at.phone"));
    expect(itemPlace("chapter.decision-day", "granted")).toBe(say("chapter.decision-day.brief.at.granted"));
  });

  test("[R-WORLD-003] given a route's own file, when its brief is read, then it takes its base chapter's title and giver, and the next brief is the next base chapter", () => {
    expect(baseOf("chapter.build-the-file-talent")).toBe("chapter.build-the-file");
    const view = engineView();
    const talent = briefOf({ chapter: { ...view.chapter, current: "chapter.build-the-file-talent", items: [{ id: "portfolio", met: true }, { id: "endorsement", met: false }, { id: "applied", met: false }], next: null } }, "");
    expect(talent?.title).toBe(say("chapter.build-the-file.brief.title"));
    expect(nextBase("chapter.build-the-file-talent")).toBe("chapter.decision-day");
    expect(talent?.next?.chapter).toBe("chapter.decision-day");
  });

  test("[R-WORLD-003] given things in, the one now and the rest, when the chip's dots are read, then each is done, now or later in order", () => {
    expect(briefDots([{ met: true, now: false }, { met: false, now: true }, { met: false, now: false }])).toEqual(["done", "now", "later"]);
  });

  test("[R-WORLD-003] given a thing just in, when the giver's toast is read, then it counts what is left in words, says the last one, and never says chapter, step, item or task", () => {
    expect(doneToast(2)).toBe(say("chapter.brief.toast.more", { left: say("chapter.brief.count.2") }));
    expect(doneToast(1)).toBe(say("chapter.brief.toast.last"));
    for (const left of [0, 1, 2, 3, 9]) expect(doneToast(left)).not.toMatch(/chapter|step|item|task|\d/i);
  });

  test("[R-WORLD-003] given the chapter read twice, when a thing came in between, then it is told once; another chapter or nothing new tells nothing", () => {
    const view = engineView();
    const before = { ...view.chapter, items: view.chapter.items.map((item) => ({ ...item, met: false })) };
    const after = { ...before, items: before.items.map((item, index) => ({ ...item, met: index === 0 })) };
    expect(itemsDone(before, after)).toEqual([before.items[0]?.id]);
    expect(itemsDone(after, after)).toEqual([]);
    expect(itemsDone({ ...before, current: "chapter.build-the-file" }, after)).toEqual([]);
    expect(itemsDone(null, after)).toEqual([]);
  });
});

describe("the marker's exclusions", () => {
  test("[R-WORLD-005] given the joint, the barber, the suya man or the club, when a marker would stand on them, then it never does; any other thing may carry it", () => {
    expect([...FUN_ACTS].sort()).toEqual(["activity.barber", "activity.beer-joint", "activity.buy-suya", "activity.night-out"]);
    for (const fun of FUN_ACTS) {
      expect(markerAllowed({ acts: [{ stages: fun }] })).toBe(false);
      expect(markerAllowed({ acts: [{ stages: "activity.meetup", more: [fun] }] })).toBe(false);
    }
    expect(markerAllowed({ acts: [{ stages: "activity.job-hunt" }] })).toBe(true);
    expect(markerAllowed({ acts: [] })).toBe(true);
  });
});
