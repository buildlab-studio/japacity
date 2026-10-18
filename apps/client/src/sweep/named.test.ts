// A blow's money named for what it paid (world:month-end-results-sheet): the
// laptop's repair read "Something went wrong and it cost ₦85,000." on the results.
import { describe, expect, test } from "vitest";

import { content } from "@japacity/content";
import type { ReportLine } from "@japacity/sim";

import { moneyLines, otherLines } from "../features/turn/month.results";
import { newGame, openOffer } from "../shared/testing/fixtures";
import { formatMoney } from "../shared/words/format";
import { words } from "../shared/words/text";

/** The prize message claimed on the first seed whose draw makes it a fraud, or honest: the answer's lines and the month's. */
function promoClaimed(fraud: boolean): ReportLine[] {
  for (let seed = 1; seed < 40; seed += 1) {
    const game = newGame("scenario.ada", `promo-${String(seed)}`);
    const offer = openOffer(game, "offer.telco-promo");
    const lines = game.accept({ type: "offer/choose", offer: offer.id, choice: "claim" }).lines;
    if (lines.some((line) => line.key === "line.wallet.gift") !== fraud) return [...lines, ...game.endTurn().lines];
  }
  throw new Error(`No seed made the prize message ${fraud ? "a fraud" : "honest"}.`);
}

describe("money named for the blow that took it", () => {
  test("[world:month-end-results-sheet] given the laptop's fault and its repair paid, when the month's money is read, then the line names the repair and its cost", () => {
    const game = newGame();
    const offer = openOffer(game, "offer.laptop-fault");
    const mid = game.accept({ type: "offer/choose", offer: offer.id, choice: "repair" }).lines;
    const end = game.endTurn().lines;
    const repair = moneyLines([...mid, ...end]).find((entry) => entry.sign === -1 && entry.amount === 8_500_000);
    if (repair === undefined) throw new Error("The repair took nothing.");
    expect(repair.line.key).toBe("ui.line.offer-paid.offer.laptop-fault");
    expect(words(repair.line.key, repair.line.params)).toBe(`The laptop repair: ${formatMoney(8_500_000, "NGN")}.`);
  });

  test("[world:month-end-results-sheet] given an illness and the hospital paid, when the month's money is read, then the line names the treatment, never that something went wrong", () => {
    const game = newGame();
    const offer = openOffer(game, "offer.illness");
    const mid = game.accept({ type: "offer/choose", offer: offer.id, choice: "hospital" }).lines;
    const money = moneyLines([...mid, ...game.endTurn().lines]);
    const said = money.map((entry) => words(entry.line.key, entry.line.params));
    expect(said.some((line) => line.startsWith("Treatment for the illness: "))).toBe(true);
    expect(said.some((line) => line.startsWith("Something went wrong"))).toBe(false);
  });

  // "Send N2,000 to claim your prize" has no agent, so its fee is never "Paid to the agent: ₦2,000."
  test("[luck:telco-promo-may-be-fraud] [world:month-end-results-sheet] given the prize message claimed and a fraud, when the month's money is read for the results, the Bank and News, then the fee is said as sent for a prize that never came, never paid to an agent", () => {
    const lines = promoClaimed(true);
    const fee = moneyLines(lines).filter((entry) => entry.amount === 200_000 && entry.sign === -1);
    expect(fee.map((entry) => entry.line.key)).toEqual(["ui.line.offer-paid.offer.telco-promo.fee-agent"]);
    expect(words(fee[0]!.line.key, fee[0]!.line.params)).toBe(`${formatMoney(200_000, "NGN")} sent for a prize that never came.`);
    const said = [...moneyLines(lines), ...otherLines(lines).map((line) => ({ line }))].map((entry) => words(entry.line.key, entry.line.params));
    expect(said.some((line) => line.includes("agent"))).toBe(false);
  });

  test("[luck:telco-promo-may-be-fraud] [world:month-end-results-sheet] given the prize message claimed and honest, when the month's money is read, then the fee is said as sent to claim the prize and the prize as come through, and no agent is named", () => {
    const lines = promoClaimed(false);
    const said = moneyLines(lines).map((entry) => words(entry.line.key, entry.line.params));
    expect(said).toContain(`${formatMoney(200_000, "NGN")} sent to claim the prize.`);
    expect(said).toContain(`The prize came through: ${formatMoney(content.tuning.luck.promo, "NGN")}.`);
    expect(said.some((line) => line.includes("agent") || line.includes("never came"))).toBe(false);
  });
});
