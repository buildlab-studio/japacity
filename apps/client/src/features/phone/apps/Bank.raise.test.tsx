// The raise from being noticed in the Bank's Lately (activity:waiting-months-build-profile, docs/rules/world.md
// world:phone-holds-what-phones-hold), played on the real engine: the month after the manager noticed, the
// salary Lately lists is the raised pay, as the results' line said it would be.
import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { int } from "@japacity/sim";
import { draw, slot } from "@japacity/sim/testing";
import { describe, expect, test } from "vitest";

import { newGame } from "../../../shared/testing/fixtures";
import { words } from "../../../shared/words/text";
import { latelyLines } from "./Bank";

const NOTICED: Id<"activity"> = "activity.be-noticed";

/** A seed whose first draw on the job stream lands under the raise's chance. */
function raisingSeed(): string {
  for (let n = 0; n < 200; n += 1) {
    const seed = `notice-${String(n)}`;
    if (draw(seed, "job", 0, 10000) < content.tuning.activity.raiseChanceBp) return seed;
  }
  throw new Error("No seed found.");
}

describe("the raise in the Bank", () => {
  test("[activity:waiting-months-build-profile] [world:phone-holds-what-phones-hold] given the manager noticed this month, when the next month ends, then Lately lists the salary at the raised pay", () => {
    const game = newGame("scenario.banker", raisingSeed());
    const job = game.state.activity.job!;
    const pay = content.activity[job]!.pay!;
    if (typeof pay.amount !== "number") throw new Error("A fixed pay was expected.");
    const raised = pay.amount + int.bp(pay.amount, content.tuning.activity.raiseBp);
    const noticed = game.endTurn([slot(NOTICED)]).lines;
    expect(noticed.some((line) => line.key === "line.activity.raised")).toBe(true);
    if (game.state.turn.banked < 1) game.grant(1);
    const next = game.endTurn().lines;
    const lately = latelyLines({ report: { month: 0, lines: next, japacityBefore: null, japacityAfter: null, attention: false } }, [], []).map((line) => words(line.key, line.params));
    expect(lately).toContain(words("line.activity.salary", { job, amount: { currency: pay.currency, amount: raised } }));
    expect(lately).not.toContain(words("line.activity.salary", { job, amount: { currency: pay.currency, amount: pay.amount } }));
  });
});
