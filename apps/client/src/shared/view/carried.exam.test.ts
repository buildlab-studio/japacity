// An exam is one sitting (world:month-acts-carry-on and activity:waiting-months-build-profile): an act with an exam on its
// entry leaves the plan the month it runs, pass or fail, so a failed certification is never left "Ongoing", charging
// its ₦120,000 again the next month with no tap.
import { content } from "@japacity/content";
import type { Id, PlayerView, SlotPick } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { readyNurse } from "../testing/nurse";
import { plannable } from "../words/acts";
import { carriedPlan } from "./carried";

const CERTIFY = "activity.nurse-certification" as Id<"activity">;
const FEE = "fee-test" as const;

describe("an exam leaves the plan the month it runs", () => {
  test("[world:month-acts-carry-on] [activity:waiting-months-build-profile] given the ready nurse who failed the certification exam, when the month ends, then it is not in the next month's plan and nothing more is charged for it, though a new tap can sit it again", () => {
    const game = readyNurse("exam-once");
    const plan: SlotPick[] = [{ activity: CERTIFY, param: null }];
    game.endTurn(plan);
    // The nurse answers every question wrong: the exam is failed.
    for (let guard = 0; guard < 6 && game.view().setpiece !== null; guard += 1) {
      const question = game.view().setpiece!.question!;
      const asked = content.setpiece[game.view().setpiece!.entry]!;
      const answers = [...asked.questions, ...(asked.followUps ?? [])].find((one) => one.id === question.id)!.answers;
      const wrong = answers.filter((answer) => question.allowed.includes(answer.id)).sort((a, b) => a.score - b.score)[0]!;
      game.accept({ type: "setpiece/answer", question: question.id, answer: wrong.id });
    }
    const view = game.view();
    expect(view.setpiece).toBeNull();
    expect(view.documents.some((paper) => paper.id === "document.nurse-certificate")).toBe(false);
    // Still open to the life and paid for: only the exam's one sitting takes it out of the plan.
    expect(view.activities.find((option) => option.id === CERTIFY)).toMatchObject({ allowed: true, affordable: true });
    const carried = carriedPlan(plan, view);
    expect(carried).toEqual([]);
    const paid = (): number => game.state.wallet.totals.out[FEE]?.NGN ?? 0;
    const before = paid();
    expect(before).toBe(12_000_000);
    game.endTurn(carried);
    expect(paid()).toBe(before);
    // A new tap on its card sits it again.
    expect(game.view().activities.find((option) => option.id === CERTIFY)?.allowed).toBe(true);
  });

  test("[world:month-acts-carry-on] [activity:waiting-months-build-profile] given every activity in content marked once, when its month ends with it still open and paid for, then each with an exam on its entry leaves the plan and every other carries on", () => {
    const onceActs = Object.values(content.activity).filter((entry) => entry.once === true && plannable(entry.id));
    const exams = onceActs.filter((entry) => entry.exam !== undefined).map((entry) => entry.id);
    const others = onceActs.filter((entry) => entry.exam === undefined).map((entry) => entry.id);
    expect(exams).toContain(CERTIFY);
    expect(others).toContain("activity.masters-at-home");
    const open = (id: Id<"activity">): Pick<PlayerView, "freeSlots" | "job" | "activities"> => ({
      freeSlots: 3,
      job: { ...readyNurse("exam-once-list").view().job, id: null },
      activities: [{ ...readyNurse("exam-once-list").view().activities[0]!, id, allowed: true, affordable: true, params: null, missing: [] }],
    });
    for (const id of exams) expect(carriedPlan([{ activity: id, param: null }], open(id))).toEqual([]);
    for (const id of others) expect(carriedPlan([{ activity: id, param: null }], open(id))).toEqual([{ activity: id, param: null }]);
    // Any exam act in content, whether or not marked once, is one sitting.
    for (const entry of Object.values(content.activity).filter((one) => one.exam !== undefined && plannable(one.id))) expect(carriedPlan([{ activity: entry.id, param: null }], open(entry.id))).toEqual([]);
  });
});
