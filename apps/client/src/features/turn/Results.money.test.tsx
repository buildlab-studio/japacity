// The results count only what moved (docs/rules/world.md R-WORLD-008), played on the real engine:
// a bill that could not be paid is told but not counted as money gone, an agent's fee is counted
// once though the scam is told after it (docs/rules/advice.md R-ADVICE-009), and neither the
// prologue's years nor money that only sits locked counts as kept.
import { content } from "@japacity/content";
import type { Effect, ReportLine } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { stepWith } from "../../../../../packages/sim/src/engine/step";
import { applyEffects, readyLife, slot, toKnown, withEffects } from "../../../../../packages/sim/src/route/route.journey";
import { legalCommands } from "../../../../../packages/sim/src/testing/legal";
import { start, type Game } from "../../../../../packages/sim/src/testing/play";
import { standInWorld } from "@japacity/sim";
import { newGame, openOffer } from "../../shared/testing/fixtures";
import { formatMoney } from "../../shared/words/format";
import { tidyLines } from "../../shared/words/lines";
import { words } from "../../shared/words/text";
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

/** Carries out effects as `applyEffects` does, and returns the lines they tell, as a choice's reply would. */
function effectLines(game: Game, effects: Effect[]): ReportLine[] {
  const result = stepWith(withEffects(effects), game.state, { type: "offer/choose", offer: "x", choice: "y", basedOn: game.state.v }, game.world(), game.content);
  if (!result.ok) throw new Error(`The effects were rejected with ${result.code}: ${result.detail}`);
  game.state = result.state;
  return result.lines;
}

describe("money that never moved the naira", () => {
  test("[R-WORLD-008] given the life from sixteen, when its first month ends, then the prologue's earnings are not counted as kept, and read as savings from before", () => {
    const game = newGame("scenario.prologue");
    const prologue: ReportLine[] = [];
    for (let guard = 0; guard < 60 && game.state.prologue.open; guard += 1) {
      const [first] = legalCommands(game.view());
      if (first === undefined) throw new Error("The prologue is open with no legal answer.");
      prologue.push(...game.accept(first).lines);
    }
    const earned = prologue.filter((line) => line.key === "line.wallet.gig");
    expect(earned.length).toBeGreaterThan(0);
    const before = naira(game);
    const end = game.endTurn().lines;
    expect(keptNaira([...prologue, ...end])).toBe(naira(game) - before);
    const shown = tidyLines([...prologue, ...end]).map((line) => words(line.key, line.params));
    for (const line of earned) {
      expect(shown).toContain(words("ui.line.savings-before", line.params));
      expect(shown).not.toContain(words(line.key, line.params));
    }
  });

  test("[R-WORLD-008] [R-OBLIGATION-007] given held funds taken and returned in one month, when the month ends, then neither the locked money nor its return is counted, and what was kept is what really moved", () => {
    const game = newGame("scenario.ada");
    const before = naira(game);
    const taken = effectLines(game, [{ type: "obligation/open", obligation: "obligation.held-funds", principal: 1_119_311_000 }]);
    expect(taken.some((line) => line.key === "line.wallet.held-funds")).toBe(true);
    const held = Object.values(game.state.obligation.items).find((item) => item.entry === "obligation.held-funds");
    if (held === undefined) throw new Error("No held funds opened.");
    const returned = game.accept({ type: "obligation/pay", obligation: held.id, amount: held.outstanding }).lines;
    expect(returned.some((line) => line.key === "line.wallet.held-funds-return")).toBe(true);
    const end = game.endTurn().lines;
    const all = [...taken, ...returned, ...end];
    expect(moneyLines(all).some((entry) => entry.line.key.startsWith("line.wallet.held-funds") && entry.line.key !== "line.wallet.held-funds-interest")).toBe(false);
    expect(keptNaira(all)).toBe(naira(game) - before);
  });

  test("[R-WORLD-008] given the NEPA bill paid, when the month's lines are read, then its line says the bill, not money sent to family, and it is counted as money out", () => {
    const game = newGame("scenario.ada");
    applyEffects(game, [{ type: "offer/open", offer: "offer.nepa-bill" }]);
    const offer = game.view().offers.find((candidate) => candidate.entry === "offer.nepa-bill");
    if (offer === undefined) throw new Error("The NEPA bill did not open.");
    const before = naira(game);
    const paid = game.accept({ type: "offer/choose", offer: offer.id, choice: "pay" }).lines;
    const end = game.endTurn().lines;
    const bill = moneyLines([...paid, ...end]).find((entry) => entry.line.key === "ui.line.family-paid.offer.nepa-bill");
    expect(bill?.sign).toBe(-1);
    expect(words(bill?.line.key ?? "", bill?.line.params)).toMatch(/^The NEPA bill:/);
    expect(tidyLines(paid).some((line) => line.key === "line.wallet.family")).toBe(false);
    expect(keptNaira([...paid, ...end])).toBe(naira(game) - before);
  });
});

/** Ada in a world where every month is December, holding a job, so the thirteenth month can open. */
function decemberAtHome(): Game {
  const game = start({
    scenario: "scenario.ada",
    content,
    worldAt: (tick) => {
      const world = standInWorld("world-1", tick, content);
      return { ...world, vars: { ...world.vars, "var.season-december": 1 } };
    },
  });
  applyEffects(game, [{ type: "activity/start-job", job: "activity.job-teacher" }]);
  game.endTurn();
  return game;
}

describe("money named for what it was", () => {
  test("[R-WORLD-008] given a thirteenth month taken mid-month and the month's salary paid at its end, when the month's money is read, then each is told once in its own words, and what was kept is the naira's move over the whole month", () => {
    const game = decemberAtHome();
    const offer = openOffer(game, "offer.december-bonus");
    const pay = offer.terms["pay"];
    if (typeof pay !== "number") throw new Error("The thirteenth month has no pay.");
    const before = naira(game);
    const mid = game.accept({ type: "offer/choose", offer: offer.id, choice: "take" }).lines;
    const end = game.endTurn().lines;
    const money = moneyLines([...mid, ...end]);
    const paidIn = money.filter((entry) => entry.sign === 1 && entry.amount === pay);
    expect(paidIn.map((entry) => entry.line.key)).toEqual(["ui.line.offer-paid.offer.december-bonus", "line.activity.salary"]);
    expect(words(paidIn[0]?.line.key ?? "", paidIn[0]?.line.params)).toBe(`A thirteenth month's pay: ${formatMoney(pay, "NGN")}.`);
    expect(money.some((entry) => entry.line.key === "line.wallet.salary")).toBe(false);
    expect(keptNaira([...mid, ...end])).toBe(naira(game) - before);
  });

  test("[R-WORLD-008] [R-WORLD-019] given the savings circle joined, when its months end, then each share reads as the circle, the pot as the circle paying you, and what was kept is what moved", () => {
    const game = newGame("scenario.tunde");
    const circle = openOffer(game, "offer.join-ajo");
    game.accept({ type: "offer/choose", offer: circle.id, choice: "join" });
    const share = content.obligation["obligation.ajo"]?.amount ?? 0;
    const months: { lines: ReportLine[]; moved: number }[] = [];
    for (let month = 0; month < 10 && !months.some((played) => played.lines.some((line) => line.key === "line.obligation.pot")); month += 1) {
      if (game.state.turn.banked < 1) game.grant(content.tuning.turn.cap);
      const before = naira(game);
      const lines = game.endTurn().lines;
      months.push({ lines, moved: naira(game) - before });
    }
    for (const { lines, moved } of months) {
      const said = moneyLines(lines).map((entry) => words(entry.line.key, entry.line.params));
      expect(said).toContain(`Savings circle: ${formatMoney(share, "NGN")}.`);
      expect(said.some((line) => line.startsWith("Spent going out") || line.startsWith("A gift lands"))).toBe(false);
      expect(keptNaira(lines)).toBe(moved);
    }
    const potMonth = months.find((played) => played.lines.some((line) => line.key === "line.obligation.pot"));
    const pot = potMonth?.lines.find((line) => line.key === "line.obligation.pot");
    const amount = pot?.params.amount;
    if (potMonth === undefined || pot === undefined || typeof amount !== "object") throw new Error("The pot did not come within ten months.");
    const told = words(pot.key, pot.params);
    expect(told).toContain(`The circle pays you ${formatMoney(amount.amount, "NGN")}`);
    expect(moneyLines(potMonth.lines).map((entry) => words(entry.line.key, entry.line.params))).toContain(told);
  });
});
