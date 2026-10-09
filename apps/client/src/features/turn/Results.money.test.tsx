// The results count only what moved (docs/rules/world.md R-WORLD-008), played on the real engine:
// a bill that could not be paid is told but not counted as money gone, and an agent's fee is
// counted once though the scam is told after it (docs/rules/advice.md R-ADVICE-009).
import { content } from "@japacity/content";
import type { ReportLine } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { applyEffects, readyLife, slot, toKnown } from "../../../../../packages/sim/src/route/route.journey";
import type { Game } from "../../../../../packages/sim/src/testing/play";
import { newGame } from "../../shared/testing/fixtures";
import { kept, moneyLines } from "./month.results";

function naira(game: Game): number {
  const pocket = game.state.wallet.pockets.NGN;
  return pocket.bank + pocket.cash;
}

function keptNaira(lines: readonly ReportLine[]): number {
  return kept(moneyLines(lines)).find((net) => net.currency === "NGN")?.amount ?? 0;
}

/** A scammer at the stop, past the first chapter, with cash enough for his fee (as the sim's own agent tests reach one). */
function scammerGame(): { game: Game; offer: string; fee: number } {
  for (let n = 0; n < 80; n += 1) {
    const game = readyLife(content, { quiet: true, seed: `agent-${String(n)}`, qualities: { "quality.network": content.tuning.advice.networkToAsk } });
    applyEffects(game, [{ type: "activity/start-job", job: "activity.job-teacher" }]);
    toKnown(game);
    for (let month = 0; month < 6 && !game.state.chapter.done.includes("chapter.find-your-feet"); month += 1) game.endTurn();
    applyEffects(game, [{ type: "route/hear", route: "route.gulf-contract", via: "test" }]);
    game.endTurn([slot("activity.see-agent-stop", "route.gulf-contract")]);
    const item = Object.values(game.state.offer.items).find((candidate) => candidate.entry === "offer.agent-stop");
    if (item === undefined || !item.secret.fraud) continue;
    applyEffects(game, [{ type: "money/add", currency: "NGN", pocket: "cash", amount: 10_000_000, reason: "gift" }]);
    return { game, offer: item.id, fee: item.terms["fee"] as number };
  }
  throw new Error("No seed gave a scammer.");
}

describe("what the results count", () => {
  test("[R-WORLD-008] given a life with no money for its upkeep, when the month ends, then the missed bill is told but what was kept is what really moved", () => {
    const game = newGame("scenario.ada");
    const pocket = game.state.wallet.pockets.NGN;
    applyEffects(game, [
      { type: "money/take", currency: "NGN", pocket: "cash", amount: pocket.cash, reason: "social" },
      { type: "money/take", currency: "NGN", pocket: "bank", amount: pocket.bank, reason: "social" },
    ]);
    const before = naira(game);
    const { lines } = game.endTurn();
    expect(lines.some((line) => line.key === "line.obligation.missed")).toBe(true);
    expect(moneyLines(lines).some((entry) => entry.line.key === "line.obligation.missed")).toBe(false);
    expect(keptNaira(lines)).toBe(naira(game) - before);
  });

  test("[R-WORLD-008] [R-ADVICE-009] given a scammer paid mid-month, when the month ends, then his fee is counted once, as the scam, and what was kept is what really moved", () => {
    const { game, offer, fee } = scammerGame();
    const before = naira(game);
    const mid = [...game.accept({ type: "offer/choose", offer, choice: "look-office" }).lines, ...game.accept({ type: "offer/choose", offer, choice: "take" }).lines];
    const end = game.endTurn().lines;
    const counted = moneyLines([...mid, ...end]).filter((entry) => entry.amount === fee && entry.sign === -1);
    expect(counted.map((entry) => entry.line.key)).toEqual(["line.offer.agent-scam"]);
    expect(keptNaira([...mid, ...end])).toBe(naira(game) - before);
  });
});
