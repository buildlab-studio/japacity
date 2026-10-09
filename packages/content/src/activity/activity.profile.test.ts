// The waiting months' acts and the side jobs' tiers read back against docs/rules/activity.md R-ACTIVITY-013
// and R-ACTIVITY-014.
import type { ActivityEntry, Effect, Id } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { content } from "../index";
import { naira, pct } from "../units";

function entryOf(id: string): ActivityEntry {
  const entry = content.activity[id as Id<"activity">];
  if (entry === undefined) throw new Error(`No ${id} in content.`);
  return entry;
}

function adds(effects: readonly Effect[], quality: string): number | undefined {
  const found = effects.find((effect) => effect.type === "quality/add" && effect.quality === quality);
  return found?.type === "quality/add" ? found.amount : undefined;
}

describe("the waiting months' acts", () => {
  test("[R-ACTIVITY-013] given the developer's acts, when their entries are read, then each needs the page's figures, gives what the page gives and counts toward the talent route", () => {
    const open = entryOf("activity.open-source");
    expect(open.requires).toEqual([{ type: "quality/min", quality: "quality.tech", value: 40 }]);
    expect(adds(open.effects, "quality.network")).toBe(2);
    expect(open.onMonth).toEqual([{ at: 2, repeat: true, effects: [{ type: "quality/add", quality: "quality.portfolio", amount: 1 }] }]);
    const posts = entryOf("activity.tech-posts");
    expect(posts).toMatchObject({ slot: "none", once: true, requires: [{ type: "quality/min", quality: "quality.tech", value: 30 }] });
    expect([adds(posts.effects, "quality.network"), adds(posts.effects, "quality.standing")]).toEqual([1, 1]);
    const talk = entryOf("activity.conference-talk");
    expect(talk.requires).toContainEqual({ type: "quality/min", quality: "quality.portfolio", value: 2 });
    expect(talk.requires).toContainEqual({ type: "quality/min", quality: "quality.network", value: 40 });
    expect([adds(talk.effects, "quality.portfolio"), adds(talk.effects, "quality.standing"), adds(talk.effects, "quality.network")]).toEqual([1, 5, 5]);
    expect(content.setpiece["setpiece.conference-talk"]?.ask).toBe(1);
    for (const entry of [open, posts, talk]) expect(entry.counts).toContain("route.uk-talent");
  });

  test("[R-ACTIVITY-013] given being noticed, when its entry and the tuning are read, then it needs a job held six months and the raise is 10% on a 30% draw", () => {
    expect(entryOf("activity.be-noticed").requires).toEqual([{ type: "job/any" }, { type: "activity/local-tenure", months: 6 }]);
    expect(adds(entryOf("activity.be-noticed").effects, "quality.standing")).toBe(2);
    expect(content.tuning.activity).toEqual({ raiseBp: pct(10), raiseChanceBp: pct(30) });
  });

  test("[R-ACTIVITY-013] given the nurse's certification, when its entry, quiz and paper are read, then it costs ₦120,000, needs care 50 and the licence, asks three questions with one right answer each, passes at two, and gives the certificate in two months for good and care 10", () => {
    const certify = entryOf("activity.nurse-certification");
    expect(certify.cost).toEqual([{ currency: "NGN", amount: naira(120000), reason: "fee-test" }]);
    expect(certify.requires).toContainEqual({ type: "quality/min", quality: "quality.care", value: 50 });
    expect(certify.requires).toContainEqual({ type: "document/held", document: "document.nursing-licence" });
    expect(certify.exam?.pass).toBe(2);
    expect(certify.exam?.effects).toContainEqual({ type: "document/request", document: "document.nurse-certificate" });
    expect(adds(certify.exam?.effects ?? [], "quality.care")).toBe(10);
    const quiz = content.setpiece["setpiece.nurse-exam"];
    expect(quiz).toMatchObject({ ask: 3, order: "fixed" });
    expect(quiz?.questions).toHaveLength(3);
    for (const question of quiz?.questions ?? []) expect(question.answers.filter((answer) => answer.score > 0)).toHaveLength(1);
    // The last question's answers mark the paper, whichever is given.
    for (const answer of quiz?.questions.at(-1)?.answers ?? []) expect(answer.effects).toEqual([{ type: "activity/exam", activity: "activity.nurse-certification" }]);
    expect(content.document["document.nurse-certificate"]).toEqual({ id: "document.nurse-certificate", wait: [2, 2], validMonths: null, result: null });
    expect(certify.counts).toContain("route.uk-care");
  });

  test("[R-ACTIVITY-013] given a master's at home, when its entry and fees are read, then a bachelor's starts it, the fees are ₦1,800,000 in twelve instalments, the twelfth month gives a master's and it counts toward Canada's points", () => {
    const masters = entryOf("activity.masters-at-home");
    expect(masters.requires).toEqual([
      { type: "quality/min", quality: "quality.edu-level", value: 3 },
      { type: "quality/max", quality: "quality.edu-level", value: 3 },
    ]);
    expect(masters.onMonth).toEqual([
      { at: 1, effects: [{ type: "obligation/open", obligation: "obligation.masters-at-home", principal: naira(1800000) }] },
      { at: 12, effects: [{ type: "quality/add", quality: "quality.edu-level", amount: 1 }] },
    ]);
    expect(content.obligation["obligation.masters-at-home"]).toMatchObject({ type: "tuition", where: "home", currency: "NGN", term: 12, rateBp: 0 });
    expect(masters.counts).toEqual(["route.canada-points"]);
  });
});

describe("side jobs by level", () => {
  test("[R-ACTIVITY-014] given the three side jobs, when their tiers are read, then each has a tier on tech, English or network that pays more than its own pay, in its own currency", () => {
    for (const id of ["activity.night-support", "activity.weekend-tutoring", "activity.ride-driving"]) {
      const entry = entryOf(id);
      expect(entry.slot).toBe("side");
      expect(entry.tiers?.length, id).toBeGreaterThan(0);
      for (const tier of entry.tiers ?? []) {
        expect(["quality.tech", "quality.english", "quality.network"]).toContain(tier.min.quality);
        expect(tier.pay.currency).toBe(entry.pay?.currency);
        expect(tier.pay.amount as number).toBeGreaterThan(entry.pay?.amount as number);
      }
    }
    // The page's own example: ₦60,000 a month; ₦90,000 at tech 50.
    expect(entryOf("activity.weekend-tutoring").tiers).toEqual([{ min: { quality: "quality.tech", value: 50 }, pay: { currency: "NGN", amount: naira(90000) } }]);
  });
});
