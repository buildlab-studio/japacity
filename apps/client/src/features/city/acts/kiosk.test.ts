// The kiosk's ceiling in its own voice (docs/rules/luck.md R-LUCK-005): once this month's
// tickets reach the most one slip sells, the kiosk's answer says so in place of "Ticket bought".
import { content, text } from "@japacity/content";
import type { ReportLine } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { newGame } from "../../../shared/testing/fixtures";
import { earnedNaira, earnedShort, kioskCapReached } from "../../../shared/words/lottoLines";
import { say } from "../../../shared/words/text";
import { KIOSK_CAP, kioskAnswer } from "./acts";

const { maxTickets } = content.tuning.luck;

describe("the kiosk's ceiling", () => {
  test("[R-LUCK-005] [R-TEXT-007] given the month's tickets reaching the most one slip sells, when the kiosk answers the last of them, then it says the ceiling in its own voice, and before that it says a ticket was bought", () => {
    // The kiosk's words name the ceiling as five: the tuning and the words move together.
    expect(maxTickets).toBe(5);
    expect(text[KIOSK_CAP]).toMatch(/^The kiosk man says: .*five this month/);
    const game = newGame("scenario.ada");
    const lines: ReportLine[] = [];
    for (let visit = 0; visit < maxTickets; visit += 1) lines.push(...game.accept({ type: "activity/now", activity: "activity.play-lotto", param: "1" }).lines);
    const answers = lines.filter((line) => line.key === "line.activity.play-lotto.now");
    expect(answers).toHaveLength(maxTickets);
    // Up to the answer before the last: one ticket short of the ceiling.
    const before = lines.slice(0, lines.indexOf(answers[maxTickets - 2]!) + 1);
    expect(kioskCapReached(before)).toBe(false);
    expect(kioskAnswer(answers[maxTickets - 2]!, before).key).toBe("line.activity.play-lotto.now");
    expect(kioskCapReached(lines)).toBe(true);
    expect(kioskAnswer(answers[maxTickets - 1]!, lines).key).toBe(KIOSK_CAP);
  });
});

describe("tickets come from money earned", () => {
  test("[R-WALLET-020] [R-LOTTERY-018] given a view, when the kiosk reads the marked figure, then it is shut with its words only when the naira held would pay and the earned share would not; today nothing is marked and it never is", () => {
    const game = newGame("scenario.ada");
    const view = game.view();
    expect(view.wallet.marked).toBe(0);
    const held = view.pockets.NGN.bank + view.pockets.NGN.cash;
    expect(earnedNaira(view)).toBe(held);
    expect(earnedShort(view, held)).toBe(false);
    // A view with every naira held topped up, as one could read once the processor feeds the top-up.
    const marked = { ...view, wallet: { marked: held } };
    expect(earnedNaira(marked)).toBe(0);
    expect(earnedShort(marked, 1)).toBe(true);
    expect(earnedShort(marked, held + 1)).toBe(false);
    expect(earnedShort({ ...view, wallet: { marked: held - 1 } }, 1)).toBe(false);
    expect(say("ui.lottery.earned-only")).toBe("Tickets come from money you earned.");
  });
});
