// The graduate's first three months, played as a player who follows the nudge (docs/rules/world.md R-WORLD-003):
// each month the nudge's step is planned as the board or the act offers it, a job offer is taken,
// any other ask is left to lapse, and the month is ended. The ready life must not run dry before the job step is met.
import { content } from "@japacity/content";
import type { PlayerView, SlotPick } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { firstJob, huntOrder } from "../features/activity/JobList";
import { newGame } from "../shared/testing/fixtures";
import { nudgeOf } from "../features/city/nudge";

const HUNT = "activity.job-hunt";
const SEEDS = 40;
const HIRED_AT_LEAST = 30;
const MONTHS = 3;
const FIRST_CHAPTER = "chapter.find-your-feet";

/** The act that does the step the nudge names, with the param the sheet opens with; null when the nudge plans nothing. */
function actFor(view: PlayerView, key: string): SlotPick | null {
  const step = key.startsWith(`${FIRST_CHAPTER}.item.`) ? key.slice(`${FIRST_CHAPTER}.item.`.length).split(".") : [];
  if (step.length < 2 || step[1] !== "nudge") return null;
  const option = (id: string) => view.activities.find((each) => each.id === id && each.allowed);
  if (step[0] === "job") {
    // The job the sheet opens on (R-WORLD-006, the jobs list; R-ACTIVITY-005: the life's own trade first).
    const first = firstJob(view, huntOrder(view, option(HUNT)?.params ?? [])) ?? undefined;
    return first === undefined ? null : { activity: HUNT, param: first };
  }
  if (step[0] === "heard") return option("activity.meetup") === undefined ? null : { activity: "activity.meetup", param: null };
  if (step[0] === "known") {
    const route = option("activity.look-into-route")?.params?.[0];
    return route === undefined ? null : { activity: "activity.look-into-route", param: route };
  }
  return null;
}

function naira(view: PlayerView): number {
  return view.pockets.NGN.bank + view.pockets.NGN.cash;
}

describe("the graduate who follows the nudge", () => {
  test("[R-WORLD-003] given Ada, the ready life, on forty seeds, when the nudge is followed for three months, then she never reaches ₦0 and holds a job that covers her living costs by the third month's end on at least thirty", () => {
    const upkeep = content.scenario["scenario.ada"]?.obligations.find((owed) => owed.obligation === "obligation.upkeep")?.amount ?? 0;
    expect(upkeep).toBeGreaterThan(0);
    let hired = 0;
    const dry: string[] = [];
    for (let at = 0; at < SEEDS; at += 1) {
      const seed = `graduate-${String(at)}`;
      const game = newGame("scenario.ada", seed);
      for (let month = 0; month < MONTHS; month += 1) {
        const offer = game.view().offers.find((open) => open.entry === "offer.job");
        if (offer !== undefined) game.accept({ type: "offer/choose", offer: offer.id, choice: "accept" });
        const slots: SlotPick[] = [];
        for (let guard = 0; guard < 4; guard += 1) {
          const view = game.view();
          const nudge = nudgeOf({ ...view, offers: [] }, undefined, slots.map((slot) => slot.activity));
          const act = nudge.about === "step" ? actFor(view, nudge.key) : null;
          if (act === null || slots.some((slot) => slot.activity === act.activity) || slots.length >= view.freeSlots) break;
          slots.push(act);
        }
        game.endTurn(slots);
        if (naira(game.view()) <= 0) dry.push(`${seed} month ${String(month + 1)}`);
      }
      const job = game.state.activity.job;
      const pay = job === null ? null : content.activity[job]?.pay;
      if (pay !== null && pay !== undefined && pay.currency === "NGN" && typeof pay.amount === "number" && pay.amount >= upkeep) hired += 1;
    }
    expect(dry).toEqual([]);
    expect(hired).toBeGreaterThanOrEqual(HIRED_AT_LEAST);
  });
});
