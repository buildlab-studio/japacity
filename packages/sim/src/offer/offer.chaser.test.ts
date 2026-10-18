// The chaser beside the fixer and the police certificate: docs/rules/advice.md
// R-ADVICE-013, docs/rules/document.md R-DOCUMENT-007 and luck.md R-LUCK-001,
// played through the harness with the real content.
import { content, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Content, Id, OfferState } from "../engine/types";
import { applyEffects, readyLife, READY_PAPERS, toKnown } from "../testing/route.journey";
import type { Game } from "../testing/play";
import type { AgentKind, Pitch } from "./offer.agent";
import { agentProblems, AGENT_KINDS, agentReadsMoney, carriedTells, CHASED, CHASER, feeRange, kindAt, kindOf, KIND_TERM, MONTHS_TERM, PAPER_TERM, PITCH_TERM, pitchAt } from "./offer.agent";
import { FEET, GULF_ROUTE, PASSPORT, READY, STOP, TO_STOP, TRANSCRIPT } from "../testing/ids";

const POLICE: Id<"document"> = "document.police-certificate";
const GET_POLICE: Id<"activity"> = "activity.get-police-certificate";
const advice = content.tuning.advice;
const stop = content.offer[STOP]!;

/** The ready life's papers with the transcript left out, so it can be requested and wait. */
const NO_TRANSCRIPT = READY_PAPERS.filter((paper) => paper.document !== TRANSCRIPT);

/** Ada past the first chapter with the Gulf route heard; cash as given, or the ready life's. */
function pastChapterOne(seed: string, cash?: number): Game {
  const withCash = (base: Content): Content =>
    cash === undefined ? base : { ...base, scenario: { ...base.scenario, [READY]: { ...base.scenario[READY]!, pockets: { ...base.scenario[READY]!.pockets, NGN: { bank: 0, cash } } } } };
  const game = readyLife(content, { quiet: true, seed, documents: NO_TRANSCRIPT, change: withCash });
  applyEffects(game, [{ type: "activity/start-job", job: "activity.job-teacher" }]);
  toKnown(game);
  for (let month = 0; month < 8 && !game.state.chapter.done.includes(FEET); month += 1) game.endTurn();
  if (!game.state.chapter.done.includes(FEET)) throw new Error("The first chapter did not close.");
  applyEffects(game, [{ type: "route/hear", route: GULF_ROUTE, via: "test" }]);
  return game;
}

/** R-ACTIVITY-015: going to the stop is an act done at once, so the agent is at the table in the month it is sent. */
function openAt(game: Game): OfferState {
  game.accept({ type: "activity/now", activity: TO_STOP, param: GULF_ROUTE });
  const item = Object.values(game.state.offer.items).find((candidate) => candidate.entry === STOP);
  if (item === undefined) throw new Error(`${STOP} did not open.`);
  return item;
}

/** The first seed whose agent at the stop is of the kind wanted, with the police certificate still being made. */
function agentOfKind(kind: AgentKind): { game: Game; item: OfferState } {
  for (let n = 0; n < 120; n += 1) {
    const game = pastChapterOne(`chaser-${String(n)}`);
    applyEffects(game, [{ type: "document/request", document: POLICE }]);
    const item = openAt(game);
    if (kindOf(item) === kind && game.state.document[POLICE]?.state === "pending") return { game, item };
  }
  throw new Error(`No seed gave a ${kind}.`);
}

describe("the chaser among the agents", () => {
  test("[R-ADVICE-013] given the tuning, when the agents' shares are read, then the chaser's 2000 comes out of the fixer's: fixer 3000, chaser 2000, overpromiser 3000, scammer 2000", () => {
    expect(advice.agentKindsBp).toEqual({ fixer: 3000, chaser: 2000, overpromiser: 3000, scammer: 2000 });
    expect(AGENT_KINDS).toEqual(["fixer", "chaser", "overpromiser", "scammer"]);
  });

  test("[R-ADVICE-013] given every draw out of 10000, when the kind is read, then each of the four kinds comes at exactly its share, fixer first and the chaser after him", () => {
    const counts: Record<AgentKind, number> = { fixer: 0, chaser: 0, overpromiser: 0, scammer: 0 };
    for (let draw = 0; draw < 10000; draw += 1) counts[kindAt(draw, advice.agentKindsBp)] += 1;
    expect(counts).toEqual(advice.agentKindsBp);
    const shares = advice.agentKindsBp;
    expect(kindAt(shares.fixer - 1, shares)).toBe("fixer");
    expect(kindAt(shares.fixer, shares)).toBe("chaser");
    expect(kindAt(shares.fixer + shares.chaser - 1, shares)).toBe("chaser");
    expect(kindAt(shares.fixer + shares.chaser, shares)).toBe("overpromiser");
    expect(kindAt(10000 - shares.scammer, shares)).toBe("scammer");
  });

  test("[R-ADVICE-013] given every draw out of 10000, when what the agent says he does is read, then an honest agent says what he is, and the overpromisers and scammers say insider or chaser in the same proportion, so the claim never tells who is honest", () => {
    const shares = advice.agentKindsBp;
    const said: Record<AgentKind, Record<Pitch, number>> = { fixer: { insider: 0, chaser: 0 }, chaser: { insider: 0, chaser: 0 }, overpromiser: { insider: 0, chaser: 0 }, scammer: { insider: 0, chaser: 0 } };
    for (let draw = 0; draw < 10000; draw += 1) said[kindAt(draw, shares)][pitchAt(draw, shares)] += 1;
    expect(said.fixer).toEqual({ insider: shares.fixer, chaser: 0 });
    expect(said.chaser).toEqual({ insider: 0, chaser: shares.chaser });
    // Among the dishonest, a chaser's claim comes at the honest chaser's share of the honest.
    for (const kind of ["overpromiser", "scammer"] as const) {
      expect(said[kind].chaser * (shares.fixer + shares.chaser)).toBe(shares[kind] * shares.chaser);
      expect(said[kind].insider + said[kind].chaser).toBe(shares[kind]);
    }
  });

  test("[R-ADVICE-013] given the chaser's fee, when it is read, then it runs from ₦8,000 to ₦25,000 and overlaps every other kind's range, so the fee alone never names the kind", () => {
    expect(advice.chaserFee).toEqual([800000, 2500000]);
    expect(feeRange("chaser", advice)).toEqual(advice.chaserFee);
    for (const kind of ["fixer", "overpromiser", "scammer"] as const) {
      expect(feeRange(kind, advice)).toEqual(advice.fees[kind]);
      const [min, max] = feeRange(kind, advice);
      expect(advice.chaserFee[0] <= max && min <= advice.chaserFee[1]).toBe(true);
    }
  });

  test("[R-ADVICE-013] given the entries, when the chaser's tells are read, then they are the fixer's, at most one, and the content check holds", () => {
    expect(carriedTells(stop, "chaser", advice)).toEqual(carriedTells(stop, "fixer", advice));
    expect(carriedTells(stop, "chaser", advice).length).toBeLessThanOrEqual(1);
    expect(agentProblems(content)).toEqual([]);
  });

  test("[R-ADVICE-013] given the months, when the tuning is read, then the fixer brings a paper forward by two and the chaser by one", () => {
    expect(advice.fixerMonths).toBe(2);
    expect(advice.chaserMonths).toBe(1);
  });

  test("[R-ADVICE-013] given a chaser at the stop, when he opens, then his fee is in the chaser's range in whole thousands, he says he will chase it, names the paper he would move and the month, and the view never carries his kind", () => {
    const { game, item } = agentOfKind("chaser");
    const fee = item.terms["fee"] as number;
    expect(fee).toBeGreaterThanOrEqual(advice.chaserFee[0]);
    expect(fee).toBeLessThanOrEqual(advice.chaserFee[1]);
    expect((fee - advice.chaserFee[0]) % 100000).toBe(0);
    expect(item.secret.fraud).toBe(false);
    const shown = game.view().offers.find((offer) => offer.id === item.id)!;
    expect(shown.terms[KIND_TERM]).toBeUndefined();
    expect(shown.terms[PITCH_TERM]).toBe("chaser");
    expect(shown.terms[PAPER_TERM]).toBe(POLICE);
    expect(shown.terms[MONTHS_TERM]).toBe(advice.chaserMonths);
  });

  test("[R-ADVICE-013] [R-DOCUMENT-007] given a chaser and the police certificate being made, when he is paid, then the fee leaves, the certificate comes one month sooner, and the line says he follows it up", () => {
    const { game, item } = agentOfKind("chaser");
    const due = game.state.document[POLICE]!.readyMonth!;
    // The fee is a street price taken by its size, from cash and bank together (wallet.md R-WALLET-018).
    const held = (): number => game.state.wallet.pockets.NGN.cash + game.state.wallet.pockets.NGN.bank;
    const before = held();
    const result = game.accept({ type: "offer/choose", offer: item.id, choice: "take" });
    expect(before - held()).toBe(item.terms["fee"]);
    expect(game.state.document[POLICE]!.readyMonth).toBe(Math.max(game.state.turn.month + 1, due - advice.chaserMonths));
    const paid = result.events.find((event) => event.type === "offer/agent-paid") as unknown as { kind: AgentKind; paper: Id<"document"> | null };
    expect(paid).toMatchObject({ kind: "chaser", paper: POLICE });
    expect(result.lines.map((line) => line.key)).toContain("line.offer.agent-chaser-paid");
    expect(text["line.offer.agent-chaser-paid"]).toBeDefined();
  });

  test("[R-ADVICE-013] [R-DOCUMENT-007] given a fixer and the police certificate being made, when he is paid, then the certificate comes two months sooner", () => {
    const { game, item } = agentOfKind("fixer");
    const due = game.state.document[POLICE]!.readyMonth!;
    game.accept({ type: "offer/choose", offer: item.id, choice: "take" });
    expect(game.state.document[POLICE]!.readyMonth).toBe(Math.max(game.state.turn.month + 1, due - advice.fixerMonths));
  });

  test("[R-ADVICE-013] given a chaser and only a passport being made, when he is paid, then nothing moves, since he chases only the transcript, the police certificate and the TB test", () => {
    expect(CHASED).toEqual([TRANSCRIPT, POLICE, "document.tb-certificate"]);
    for (let n = 0; n < 120; n += 1) {
      const game = pastChapterOne(`chaser-passport-${String(n)}`);
      applyEffects(game, [{ type: "document/void", document: PASSPORT }]);
      applyEffects(game, [{ type: "document/request", document: PASSPORT }]);
      const item = openAt(game);
      if (kindOf(item) !== "chaser") continue;
      expect(item.terms[PAPER_TERM]).toBe("");
      const due = game.state.document[PASSPORT]!.readyMonth;
      const result = game.accept({ type: "offer/choose", offer: item.id, choice: "take" });
      expect(game.state.document[PASSPORT]!.readyMonth).toBe(due);
      expect(result.lines.map((line) => line.key)).toContain("line.offer.agent-chaser-paid-nothing-waiting");
      return;
    }
    throw new Error("No seed gave a chaser.");
  });
});

describe("the chaser a friend puts you onto", () => {
  const friend = content.offer[CHASER]!;

  test("[R-ADVICE-013] [R-ADVICE-007] given the friend's chaser, when its entry is read, then it is rolled, reads the place, the first chapter and the chased papers being made, and never money", () => {
    expect(friend.chanceBp).toBeGreaterThan(0);
    expect(friend.fraudBp).toBe(0);
    expect(agentReadsMoney(friend)).toBe(false);
    expect(friend.when).toContainEqual({ type: "chapter/done", chapter: FEET });
    expect(friend.when).toContainEqual({ type: "place/is", where: "home" });
    expect(friend.when).toContainEqual({ type: "any", of: CHASED.map((document) => ({ type: "document/pending", document })) });
  });

  test("[R-ADVICE-013] given the transcript or the police certificate being made, when the friend's chaser opens, then she is a chaser from the name pool, names that paper, and is paid to bring it a month sooner", () => {
    for (const paper of [TRANSCRIPT, POLICE]) {
      const game = pastChapterOne(`friend-${paper}`);
      applyEffects(game, [{ type: "document/request", document: paper }]);
      applyEffects(game, [{ type: "offer/open", offer: CHASER }]);
      const item = Object.values(game.state.offer.items).find((candidate) => candidate.entry === CHASER)!;
      expect(kindOf(item)).toBe("chaser");
      expect(item.terms[PITCH_TERM]).toBe("chaser");
      expect(item.terms[PAPER_TERM]).toBe(paper);
      expect(text[`${String(item.terms["agent"])}.name`]).toBe("Hadiza");
      const due = game.state.document[paper]!.readyMonth!;
      game.accept({ type: "offer/choose", offer: item.id, choice: "take" });
      expect(game.state.document[paper]!.readyMonth).toBe(Math.max(game.state.turn.month + 1, due - advice.chaserMonths));
    }
  });

  test("[R-ADVICE-013] given no chased paper being made, when the friend's chaser is opened, then nothing opens", () => {
    const game = pastChapterOne("friend-none");
    applyEffects(game, [{ type: "offer/open", offer: CHASER }]);
    expect(Object.values(game.state.offer.items).filter((item) => item.entry === CHASER)).toEqual([]);
  });

  test("[R-ADVICE-013] given the transcript being made for months on end, when the months pass on some seed, then the friend's chaser comes up by herself", () => {
    let came = 0;
    for (let n = 0; n < 20 && came === 0; n += 1) {
      const game = pastChapterOne(`friend-roll-${String(n)}`);
      applyEffects(game, [{ type: "document/request", document: TRANSCRIPT }]);
      for (let month = 0; month < 4 && came === 0 && game.state.document[TRANSCRIPT]?.state === "pending"; month += 1) {
        game.endTurn();
        came = Object.values(game.state.offer.items).filter((item) => item.entry === CHASER).length;
      }
    }
    expect(came).toBe(1);
  });
});

describe("no kind and no fee reads money", () => {
  test("[R-LUCK-001] [R-ADVICE-013] given two lives alike but for the money they hold, when the same agent opens in each, then his kind, his claim, his fee and the paper he names are the same", () => {
    for (let n = 0; n < 12; n += 1) {
      const seed = `money-${String(n)}`;
      const opened = (cash: number) => {
        const game = pastChapterOne(seed, 0);
        applyEffects(game, [{ type: "document/request", document: POLICE }]);
        if (cash > 0) applyEffects(game, [{ type: "money/add", currency: "NGN", pocket: "cash", amount: cash, reason: "gift" }]);
        for (const entry of [STOP, CHASER]) applyEffects(game, [{ type: "offer/open", offer: entry }]);
        return Object.values(game.state.offer.items)
          .filter((item) => item.entry === STOP || item.entry === CHASER)
          .map((item) => [item.entry, kindOf(item), item.terms[PITCH_TERM], item.terms["fee"], item.terms[PAPER_TERM]]);
      };
      const poor = opened(0);
      expect(poor).toHaveLength(2);
      expect(opened(500000)).toEqual(poor);
      expect(opened(500000000)).toEqual(poor);
    }
  });
});

describe("the police certificate", () => {
  test("[R-DOCUMENT-007] given the police certificate, when it is requested at the visa centre's notice, then ₦5,000 leaves and it is issued between one and three months later, valid twelve", () => {
    const entry = content.document[POLICE]!;
    expect(entry).toMatchObject({ wait: [1, 3], validMonths: 12 });
    const seen = new Set<number>();
    for (let n = 0; n < 12; n += 1) {
      const game = readyLife(content, { quiet: true, seed: `police-${String(n)}` });
      const paid = () => game.state.wallet.totals.out["fee-document"]?.NGN ?? 0;
      const before = paid();
      // R-ACTIVITY-015: the request is made at once, in the month in hand, and its wait runs from that month.
      game.accept({ type: "activity/now", activity: GET_POLICE, param: null });
      const month = game.state.turn.month;
      const doc = game.state.document[POLICE]!;
      expect(doc.state).toBe("pending");
      const wait = doc.readyMonth! - month;
      expect(wait).toBeGreaterThanOrEqual(1);
      expect(wait).toBeLessThanOrEqual(3);
      seen.add(wait);
      expect(paid() - before).toBe(500000);
      for (let left = 0; left < 4 && game.state.document[POLICE]!.state !== "held"; left += 1) game.endTurn();
      const held = game.state.document[POLICE]!;
      expect(held.state).toBe("held");
      expect(held.expiresMonth).toBe(doc.readyMonth! + 12);
    }
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });
});
